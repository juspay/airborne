#!/bin/bash
# encrypt-envs.sh - Encrypt environment variables using KMS + Envelope Encryption
#
# Usage:
#   ./encrypt-envs.sh                    # Encrypt all secrets using KMS
#   ./encrypt-envs.sh --plaintext        # Generate plaintext .env (no encryption)
#
# This script:
# 1. Generates a random Data Encryption Key (DEK) locally (saved to .masterkey.local)
# 2. Encrypts the DEK using AWS KMS
# 3. Encrypts each secret using AES-GCM with the DEK
# 4. Outputs the encrypted master key and encrypted secrets

set -e
set -o pipefail

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
ENV_EXAMPLE="${SCRIPT_DIR}/../.env.example"
MASTERKEY_FILE="${SCRIPT_DIR}/../.masterkey.local"
PYTHON_DEPS_DIR="${SCRIPT_DIR}/.python-tools"
PYTHON_BIN=""

# Check for plaintext mode
PLAINTEXT_MODE=false
if [[ "$1" == "--plaintext" ]]; then
    PLAINTEXT_MODE=true
    echo -e "${YELLOW}Running in PLAINTEXT mode (no encryption)${NC}"
fi

ensure_python_crypto() {
    if [[ -z "$PYTHON_BIN" ]]; then
        for candidate in python3 /usr/bin/python3 /usr/local/bin/python3; do
            if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import ssl' >/dev/null 2>&1; then
                PYTHON_BIN=$(command -v "$candidate")
                break
            fi
        done
    fi

    if [[ -z "$PYTHON_BIN" ]]; then
        echo -e "${RED}No Python interpreter with SSL support was found.${NC}" >&2
        exit 1
    fi

    if "$PYTHON_BIN" -c 'from cryptography.hazmat.primitives.ciphers.aead import AESGCM' >/dev/null 2>&1; then
        return 0
    fi

    if PYTHONPATH="$PYTHON_DEPS_DIR${PYTHONPATH:+:$PYTHONPATH}" "$PYTHON_BIN" -c 'from cryptography.hazmat.primitives.ciphers.aead import AESGCM' >/dev/null 2>&1; then
        return 0
    fi

    echo -e "${YELLOW}Installing Python cryptography dependency...${NC}"
    mkdir -p "$PYTHON_DEPS_DIR"
    "$PYTHON_BIN" -m pip install --quiet --target "$PYTHON_DEPS_DIR" cryptography
}

shell_quote() {
    local value="$1"
    printf "'%s'" "$(printf '%s' "$value" | sed "s/'/'\\\\''/g")"
}

strip_shell_quotes() {
    local value="$1"

    if [[ ${#value} -ge 2 ]]; then
        if [[ "${value#\'}" != "$value" ]] && [[ "${value%\'}" != "$value" ]]; then
            value="${value#\'}"
            value="${value%\'}"
            value="${value//\'\\\'\'/\'}"
        elif [[ "${value#\"}" != "$value" ]] && [[ "${value%\"}" != "$value" ]]; then
            value="${value#\"}"
            value="${value%\"}"
        fi
    fi

    printf '%s' "$value"
}

read_env_raw() {
    local key="$1"
    local value
    value=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | head -1)
    strip_shell_quotes "$value"
}

is_value_empty() {
    local value="$1"
    case "$value" in
        ""|"''"|'""')
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

upsert_env_raw() {
    local key="$1"
    local raw_value="$2"
    local tmp_file

    tmp_file=$(mktemp "${TMPDIR:-/tmp}/airborne-env.XXXXXX")

    if [[ -f "$ENV_FILE" ]]; then
        awk -v key="$key" -v value="$raw_value" '
            BEGIN { updated = 0 }
            index($0, key "=") == 1 { print key "=" value; updated = 1; next }
            { print }
            END { if (!updated) print key "=" value }
        ' "$ENV_FILE" > "$tmp_file"
    else
        printf "%s=%s\n" "$key" "$raw_value" > "$tmp_file"
    fi

    mv "$tmp_file" "$ENV_FILE"
}

sync_superposition_rc_env_defaults() {
    local superposition_url superposition_rc_url
    local superposition_user_token superposition_rc_user_token
    local superposition_org_token superposition_rc_org_token

    superposition_url=$(read_env_raw "SUPERPOSITION_URL")
    superposition_rc_url=$(read_env_raw "SUPERPOSITION_RC_URL")
    if is_value_empty "$superposition_rc_url"; then
        upsert_env_raw "SUPERPOSITION_RC_URL" "$superposition_url"
    fi

    superposition_user_token=$(read_env_raw "SUPERPOSITION_USER_TOKEN")
    superposition_rc_user_token=$(read_env_raw "SUPERPOSITION_RC_USER_TOKEN")
    if is_value_empty "$superposition_rc_user_token"; then
        upsert_env_raw "SUPERPOSITION_RC_USER_TOKEN" "$superposition_user_token"
    fi

    superposition_org_token=$(read_env_raw "SUPERPOSITION_ORG_TOKEN")
    superposition_rc_org_token=$(read_env_raw "SUPERPOSITION_RC_ORG_TOKEN")
    if is_value_empty "$superposition_rc_org_token"; then
        upsert_env_raw "SUPERPOSITION_RC_ORG_TOKEN" "$superposition_org_token"
    fi
}

# Function to encrypt a value using AES-GCM
encrypt_value() {
    local value="$1"
    local key="$2"

    printf '%s' "$value" | PYTHONPATH="$PYTHON_DEPS_DIR${PYTHONPATH:+:$PYTHONPATH}" \
        "$PYTHON_BIN" "$SCRIPT_DIR/aes_gcm_encrypt.py" "$key"
}

# Function to encrypt master key with KMS
encrypt_master_key_with_kms() {
    local master_key="$1"
    local kms_key_id="${KMS_KEY_ID:-alias/airborne-secrets}"
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}AWS CLI not found. Cannot encrypt with KMS.${NC}"
        echo -e "${YELLOW}Set KMS_KEY_ID environment variable or ensure AWS CLI is configured.${NC}"
        exit 1
    fi
    
    # Encrypt using KMS
    local encrypted=$(echo -n "$master_key" | aws kms encrypt \
        --key-id "$kms_key_id" \
        --plaintext fileb:///dev/stdin \
        --output text \
        --query CiphertextBlob)
    
    echo "$encrypted"
}

# List of secret variables that should be encrypted
SECRETS=(
    "DB_PASSWORD"
    "DB_MIGRATION_PASSWORD"
    "KEYCLOAK_SECRET"
    "SUPERPOSITION_TOKEN"
    "SUPERPOSITION_USER_TOKEN"
    "SUPERPOSITION_ORG_TOKEN"
    "SUPERPOSITION_RC_USER_TOKEN"
    "SUPERPOSITION_RC_ORG_TOKEN"
    "GOOGLE_SERVICE_ACCOUNT_KEY"
)

echo -e "${YELLOW}🔐 Environment Encryption Tool${NC}"
echo ""

# Check if .env.example exists
if [[ ! -f "$ENV_EXAMPLE" ]]; then
    echo -e "${RED}Error: .env.example not found at $ENV_EXAMPLE${NC}"
    exit 1
fi

# Create .env from example if it doesn't exist
if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

# Keep local RC Superposition vars aligned with existing Superposition vars when unset.
sync_superposition_rc_env_defaults

if [[ "$PLAINTEXT_MODE" == true ]]; then
    echo -e "${GREEN}✅ Plaintext .env file ready at: $ENV_FILE${NC}"
    echo ""
    echo -e "${YELLOW}To use encryption later, run:${NC}"
    echo "  ./scripts/encrypt-envs.sh"
    exit 0
fi

echo -e "${YELLOW}Encrypting secrets with KMS + Envelope Encryption...${NC}"
echo ""

ensure_python_crypto

# Check if master key already exists
if [[ -f "$MASTERKEY_FILE" ]]; then
    echo -e "${YELLOW}Found existing master key at: $MASTERKEY_FILE${NC}"
    MASTER_KEY=$(cat "$MASTERKEY_FILE")
    echo -e "${GREEN}✅ Using existing master key${NC}"
else
    # Generate master key
    echo -e "${YELLOW}Generating new Data Encryption Key (DEK)...${NC}"
    MASTER_KEY=$(openssl rand -hex 32)
    
    # Save master key locally
    echo "$MASTER_KEY" > "$MASTERKEY_FILE"
    chmod 600 "$MASTERKEY_FILE"
    echo -e "${GREEN}✅ DEK generated and saved to: $MASTERKEY_FILE${NC}"
    echo -e "${YELLOW}⚠️  Keep this file secure and do not commit it to git!${NC}"
fi

# Encrypt master key with KMS
echo -e "${YELLOW}Encrypting DEK with KMS...${NC}"
ENCRYPTED_MASTER_KEY=$(encrypt_master_key_with_kms "$MASTER_KEY")
echo -e "${GREEN}✅ DEK encrypted with KMS${NC}"

# Create new .env file
NEW_ENV_FILE="${ENV_FILE}.new"
echo "# Encrypted environment configuration" > "$NEW_ENV_FILE"
echo "# Generated: $(date)" >> "$NEW_ENV_FILE"
echo "" >> "$NEW_ENV_FILE"
echo "# Encryption settings" >> "$NEW_ENV_FILE"
echo "USE_ENCRYPTED_SECRETS=true" >> "$NEW_ENV_FILE"
echo "MASTER_KEY=$ENCRYPTED_MASTER_KEY" >> "$NEW_ENV_FILE"
echo "" >> "$NEW_ENV_FILE"

# Encrypt each secret
echo -e "${YELLOW}Encrypting secrets...${NC}"
while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    if [[ "$line" =~ ^#.*$ ]] || [[ -z "$line" ]]; then
        echo "$line" >> "$NEW_ENV_FILE"
        continue
    fi
    
    # Extract key and value
    if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        
        # Skip MASTER_KEY and USE_ENCRYPTED_SECRETS (already handled)
        if [[ "$key" == "MASTER_KEY" ]] || [[ "$key" == "USE_ENCRYPTED_SECRETS" ]]; then
            continue
        fi
        
        # Check if this is a secret
        if [[ " ${SECRETS[@]} " =~ " ${key} " ]]; then
            if printf '%s' "$value" | grep -q '"nonce"' && printf '%s' "$value" | grep -q '"ciphertext"'; then
                echo -e "  Skipping already encrypted: $key"
                echo "$key=$(shell_quote "$value")" >> "$NEW_ENV_FILE"
            else
                echo -e "  Encrypting: $key"
                encrypted_value=$(encrypt_value "$value" "$MASTER_KEY")
                echo "$key=$(shell_quote "$encrypted_value")" >> "$NEW_ENV_FILE"
            fi
        else
            # Non-secret, keep as-is
            echo "$line" >> "$NEW_ENV_FILE"
        fi
    else
        echo "$line" >> "$NEW_ENV_FILE"
    fi
done < "$ENV_FILE"

# Replace old .env with new encrypted version
mv "$NEW_ENV_FILE" "$ENV_FILE"

echo ""
echo -e "${GREEN}✅ Encryption complete!${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  • Master Key: Saved to .masterkey.local (local only)"
echo "  • Encrypted Master Key: Stored in .env (KMS encrypted)"
echo "  • Secrets: Encrypted with AES-256-GCM using DEK"
echo "  • Storage Format: {nonce, ciphertext}"
echo ""
echo -e "${YELLOW}Environment file updated: $ENV_FILE${NC}"
echo ""
echo -e "${YELLOW}To run locally with encryption:${NC}"
echo "  make run"
echo ""
echo -e "${YELLOW}To run locally without encryption:${NC}"
echo "  USE_ENCRYPTED_SECRETS=false make run"

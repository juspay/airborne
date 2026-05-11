#!/bin/bash
# Copyright 2025 Juspay Technologies
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

# Check if encryption is enabled - MUST check before sourcing .env
# so environment variable takes precedence
PRESET_USE_ENCRYPTED_SECRETS="${USE_ENCRYPTED_SECRETS-}"
HAS_PRESET_USE_ENCRYPTED_SECRETS=0
if [ "${USE_ENCRYPTED_SECRETS+x}" = "x" ]; then
    HAS_PRESET_USE_ENCRYPTED_SECRETS=1
fi

USE_ENCRYPTION="${USE_ENCRYPTED_SECRETS:-true}"

if [ -f .env ]; then
    set -a
    . .env
    set +a
fi

# Re-apply external environment variable if it was explicitly set (override .env)
if [ "$HAS_PRESET_USE_ENCRYPTED_SECRETS" -eq 1 ]; then
    USE_ENCRYPTED_SECRETS="$PRESET_USE_ENCRYPTED_SECRETS"
    export USE_ENCRYPTED_SECRETS
    USE_ENCRYPTION="$PRESET_USE_ENCRYPTED_SECRETS"
else
    USE_ENCRYPTION="${USE_ENCRYPTED_SECRETS:-true}"
fi

MASTERKEY_FILE=".masterkey.local"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_DEPS_DIR="${SCRIPT_DIR}/.python-tools"
PYTHON_BIN=""

AWS_DEFAULT_REGION=$AWS_REGION
KMS_KEY_ID="alias/my-local-key"

portable_sed_inplace() {
    local pattern="$1"
    local file="$2"
    
    if sed --version >/dev/null 2>&1; then
        sed -i "$pattern" "$file"
    else
        sed -i '' "$pattern" "$file"
    fi
}

ensure_python_crypto() {
    if [ -z "$PYTHON_BIN" ]; then
        for candidate in python3 /usr/bin/python3 /usr/local/bin/python3; do
            if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import ssl' >/dev/null 2>&1; then
                PYTHON_BIN=$(command -v "$candidate")
                break
            fi
        done
    fi

    if [ -z "$PYTHON_BIN" ]; then
        echo "${RED}❌ ERROR: No Python interpreter with SSL support was found${NC}" >&2
        return 1
    fi

    if "$PYTHON_BIN" -c 'from cryptography.hazmat.primitives.ciphers.aead import AESGCM' >/dev/null 2>&1; then
        return 0
    fi

    if PYTHONPATH="$PYTHON_DEPS_DIR${PYTHONPATH:+:$PYTHONPATH}" "$PYTHON_BIN" -c 'from cryptography.hazmat.primitives.ciphers.aead import AESGCM' >/dev/null 2>&1; then
        return 0
    fi

    echo "${YELLOW}📦 Installing Python cryptography dependency...${NC}"
    mkdir -p "$PYTHON_DEPS_DIR"
    "$PYTHON_BIN" -m pip install --quiet --target "$PYTHON_DEPS_DIR" cryptography
}

strip_shell_quotes() {
    local value="$1"

    if [ "${#value}" -ge 2 ]; then
        if [ "${value#\'}" != "$value" ] && [ "${value%\'}" != "$value" ]; then
            value="${value#\'}"
            value="${value%\'}"
            value="${value//\'\\\'\'/\'}"
        elif [ "${value#\"}" != "$value" ] && [ "${value%\"}" != "$value" ]; then
            value="${value#\"}"
            value="${value%\"}"
        fi
    fi

    printf '%s' "$value"
}

shell_quote() {
    local value="$1"
    printf "'%s'" "$(printf '%s' "$value" | sed "s/'/'\\\\''/g")"
}

upsert_env_var() {
    local file="$1"
    local key="$2"
    local raw_value="$3"
    local tmp_file
    local quoted_value

    tmp_file=$(mktemp "${TMPDIR:-/tmp}/airborne-env.XXXXXX")
    quoted_value=$(shell_quote "$raw_value")

    if [ -f "$file" ]; then
        awk -v key="$key" -v value="$quoted_value" '
            BEGIN { updated = 0 }
            index($0, key "=") == 1 { print key "=" value; updated = 1; next }
            { print }
            END { if (!updated) print key "=" value }
        ' "$file" > "$tmp_file"
    else
        printf "%s=%s\n" "$key" "$quoted_value" > "$tmp_file"
    fi

    mv "$tmp_file" "$file"
}

read_env_value() {
    local key="$1"
    local value=""

    if [ -f ".env" ]; then
        value=$(grep "^${key}=" ".env" 2>/dev/null | cut -d'=' -f2- | head -1)
        value=$(strip_shell_quotes "$value")
    fi

    echo "$value"
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

sync_superposition_rc_env_defaults() {
    local superposition_url superposition_rc_url
    local superposition_user_token superposition_rc_user_token
    local superposition_org_token superposition_rc_org_token

    superposition_url=$(read_env_value "SUPERPOSITION_URL")
    superposition_rc_url=$(read_env_value "SUPERPOSITION_RC_URL")
    if is_value_empty "$superposition_rc_url"; then
        upsert_env_var ".env" "SUPERPOSITION_RC_URL" "$superposition_url"
    fi

    superposition_user_token=$(read_env_value "SUPERPOSITION_USER_TOKEN")
    superposition_rc_user_token=$(read_env_value "SUPERPOSITION_RC_USER_TOKEN")
    if is_value_empty "$superposition_rc_user_token"; then
        upsert_env_var ".env" "SUPERPOSITION_RC_USER_TOKEN" "$superposition_user_token"
    fi

    superposition_org_token=$(read_env_value "SUPERPOSITION_ORG_TOKEN")
    superposition_rc_org_token=$(read_env_value "SUPERPOSITION_RC_ORG_TOKEN")
    if is_value_empty "$superposition_rc_org_token"; then
        upsert_env_var ".env" "SUPERPOSITION_RC_ORG_TOKEN" "$superposition_org_token"
    fi
}

sync_superposition_rc_env_defaults

echo "${YELLOW}☁️ AWS Endpoint:${NC} ${GREEN}${AWS_ENDPOINT_URL}${NC}"
echo "${YELLOW}🪣 S3 Bucket:${NC} ${GREEN}${AWS_BUCKET}${NC}"
echo "${YELLOW}🌍 Region:${NC} ${GREEN}${AWS_REGION}${NC}"

echo "${YELLOW}🔑 Creating KMS key...${NC}"
KEYID=$(aws --endpoint-url=${AWS_ENDPOINT_URL} kms create-key \
  --description "Key for encrypting environment variables" \
  --query 'KeyMetadata.KeyId' \
  --output text)

echo "${GREEN}✅ Created KMS key with ID: $KEYID${NC}"

echo "${YELLOW}🔗 Creating KMS alias...${NC}"
if aws --endpoint-url=${AWS_ENDPOINT_URL} kms list-aliases | grep -q "$KMS_KEY_ID"; then
  aws --endpoint-url=${AWS_ENDPOINT_URL} kms update-alias \
    --alias-name "$KMS_KEY_ID" \
    --target-key-id "$KEYID"
else
  aws --endpoint-url=${AWS_ENDPOINT_URL} kms create-alias \
    --alias-name "$KMS_KEY_ID" \
    --target-key-id "$KEYID"
fi
echo "${GREEN}✅ KMS alias configured: $KMS_KEY_ID${NC}"

echo "${YELLOW}🪣 Creating S3 bucket...${NC}"
aws --endpoint-url=${AWS_ENDPOINT_URL} s3 mb s3://$AWS_BUCKET >/dev/null 2>&1 || true
echo "${GREEN}✅ S3 bucket ready: $AWS_BUCKET${NC}"

# Variables that need encryption/processing
SENSITIVE_VARS=(
    "DB_PASSWORD"
    "DB_MIGRATION_PASSWORD"
    "KEYCLOAK_SECRET"
    "SUPERPOSITION_TOKEN"
    "SUPERPOSITION_USER_TOKEN"
    "SUPERPOSITION_ORG_TOKEN"
    "SUPERPOSITION_RC_USER_TOKEN"
    "SUPERPOSITION_RC_ORG_TOKEN"
)

# Get values from .env.example or .env.generated
get_value() {
    local var=$1
    local value=""
    
    # Try .env.generated first (contains plaintext values from keycloak-init)
    if [ -f ".env.generated" ]; then
        value=$(grep "^${var}=" ".env.generated" 2>/dev/null | cut -d'=' -f2- | head -1)
    fi
    
    # Fallback to .env.example
    if [ -z "$value" ] && [ -f ".env.example" ]; then
        value=$(grep "^${var}=" ".env.example" 2>/dev/null | cut -d'=' -f2- | head -1)
    fi
    
    # Final fallback to .env
    if [ -z "$value" ] && [ -f ".env" ]; then
        value=$(grep "^${var}=" ".env" 2>/dev/null | cut -d'=' -f2- | head -1)
        value=$(strip_shell_quotes "$value")
        # Check if it's encrypted JSON
        if echo "$value" | grep -q '{.*}'; then
            value=""  # Reset if encrypted
        fi
    fi
    
    echo "$value"
}

if [ "$USE_ENCRYPTION" = "true" ]; then
    echo "${YELLOW}🔐 Encryption enabled - using envelope encryption...${NC}"
    ensure_python_crypto
    
    # Check if master key exists
    if [ ! -f "$MASTERKEY_FILE" ]; then
        echo "${YELLOW}Generating new master key...${NC}"
        MASTER_KEY=$(openssl rand -hex 32)
        echo "$MASTER_KEY" > "$MASTERKEY_FILE"
        chmod 600 "$MASTERKEY_FILE"
        echo "${GREEN}✅ Master key saved to $MASTERKEY_FILE${NC}"
    else
        MASTER_KEY=$(cat "$MASTERKEY_FILE")
        echo "${GREEN}✅ Using existing master key${NC}"
    fi
    
    # Encrypt master key with KMS
    echo "${YELLOW}🔐 Encrypting master key with KMS...${NC}"
    ENCRYPTED_MASTER_KEY=$(echo -n "$MASTER_KEY" | aws --endpoint-url=${AWS_ENDPOINT_URL} kms encrypt \
      --key-id "$KMS_KEY_ID" \
      --plaintext fileb:///dev/stdin \
      --query CiphertextBlob \
      --output text)
    
    # Update .env with encrypted master key
    if grep -q "^MASTER_KEY=" ".env"; then
        portable_sed_inplace "s|^MASTER_KEY=.*|MASTER_KEY=$ENCRYPTED_MASTER_KEY|" ".env"
    else
        echo "MASTER_KEY=$ENCRYPTED_MASTER_KEY" >> ".env"
    fi
    
    # Set USE_ENCRYPTED_SECRETS
    if grep -q "^USE_ENCRYPTED_SECRETS=" ".env"; then
        portable_sed_inplace "s|^USE_ENCRYPTED_SECRETS=.*|USE_ENCRYPTED_SECRETS=true|" ".env"
    else
        echo "USE_ENCRYPTED_SECRETS=true" >> ".env"
    fi
    
    echo "${YELLOW}🔐 Encrypting sensitive environment variables...${NC}"
    
    encrypt_with_master_key() {
        local var_name=$1
        local value=$2

        if ! printf '%s' "$value" | PYTHONPATH="$PYTHON_DEPS_DIR${PYTHONPATH:+:$PYTHONPATH}" \
            "$PYTHON_BIN" "$SCRIPT_DIR/aes_gcm_encrypt.py" "$MASTER_KEY"; then
            echo "${RED}❌ ERROR: Encryption failed for $var_name${NC}" >&2
            return 1
        fi
    }
    
    for var in "${SENSITIVE_VARS[@]}"; do
        echo "${YELLOW}  Processing $var...${NC}"
        VALUE=$(get_value "$var")
        
        if [ -n "$VALUE" ]; then
            # Skip KEYCLOAK_SECRET if already handled by init-keycloak.sh
            if [ "$var" = "KEYCLOAK_SECRET" ]; then
                # Check if already encrypted in .env
                CURRENT_VAL=$(grep "^${var}=" ".env" 2>/dev/null | cut -d'=' -f2- | head -1)
                CURRENT_VAL=$(strip_shell_quotes "$CURRENT_VAL")
                if [ -n "$CURRENT_VAL" ] && echo "$CURRENT_VAL" | grep -q '{.*}'; then
                    echo "${GREEN}  ✅ $var already encrypted${NC}"
                    continue
                fi
            fi
            
            ENCRYPTED_JSON=$(encrypt_with_master_key "$var" "$VALUE")
            upsert_env_var ".env" "$var" "$ENCRYPTED_JSON"
            echo "${GREEN}  ✅ $var encrypted${NC}"
        else
            echo "${YELLOW}  ⚠️ $var not found in source files${NC}"
        fi
    done
    
    echo "${GREEN}✅ All sensitive variables encrypted with envelope encryption${NC}"
    echo ""
    echo "${YELLOW}Encryption Summary:${NC}"
    echo "  • Master Key: Saved to $MASTERKEY_FILE (local only)"
    echo "  • Encrypted Master Key: Stored in .env (KMS encrypted)"
    echo "  • Secrets: Encrypted with AES-256-GCM"
    
else
    echo "${YELLOW}📝 Encryption disabled - using plaintext mode...${NC}"
    
    # Set USE_ENCRYPTED_SECRETS to false
    if grep -q "^USE_ENCRYPTED_SECRETS=" ".env"; then
        portable_sed_inplace "s|^USE_ENCRYPTED_SECRETS=.*|USE_ENCRYPTED_SECRETS=false|" ".env"
    else
        echo "USE_ENCRYPTED_SECRETS=false" >> ".env"
    fi
    
    # Copy plaintext values from .env.example if not present
    for var in "${SENSITIVE_VARS[@]}"; do
        # Skip KEYCLOAK_SECRET (handled by init-keycloak.sh)
        if [ "$var" = "KEYCLOAK_SECRET" ]; then
            continue
        fi
        
        echo "${YELLOW}  Processing $var...${NC}"
        VALUE=$(get_value "$var")
        
        if [ -n "$VALUE" ]; then
            upsert_env_var ".env" "$var" "$VALUE"
            echo "${GREEN}  ✅ $var set${NC}"
        else
            echo "${YELLOW}  ⚠️ $var not found in source files${NC}"
        fi
    done
    
    echo "${GREEN}✅ All variables set in plaintext mode${NC}"
fi

echo "${GREEN}✅ LocalStack initialization complete!${NC}"

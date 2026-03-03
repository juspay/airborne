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

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
ENV_EXAMPLE="${SCRIPT_DIR}/../.env.example"
MASTERKEY_FILE="${SCRIPT_DIR}/../.masterkey.local"

# Check for plaintext mode
PLAINTEXT_MODE=false
if [[ "$1" == "--plaintext" ]]; then
    PLAINTEXT_MODE=true
    echo -e "${YELLOW}Running in PLAINTEXT mode (no encryption)${NC}"
fi

# Function to encrypt a value using AES-GCM
encrypt_value() {
    local value="$1"
    local key="$2"
    
    # Generate a random nonce (12 bytes for AES-GCM)
    local nonce=$(openssl rand -hex 12)
    
    # Encrypt using AES-256-GCM
    # Output format: nonce:ciphertext:tag (all hex encoded)
    local encrypted=$(echo -n "$value" | openssl enc -aes-256-gcm -nosalt -K "$key" -iv "$nonce" 2>/dev/null | od -An -tx1 | tr -d ' \n')
    
    # Format as JSON
    echo "{\"nonce\":\"$nonce\",\"ciphertext\":\"$encrypted\"}"
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

if [[ "$PLAINTEXT_MODE" == true ]]; then
    echo -e "${GREEN}✅ Plaintext .env file ready at: $ENV_FILE${NC}"
    echo ""
    echo -e "${YELLOW}To use encryption later, run:${NC}"
    echo "  ./scripts/encrypt-envs.sh"
    exit 0
fi

echo -e "${YELLOW}Encrypting secrets with KMS + Envelope Encryption...${NC}"
echo ""

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
            echo -e "  Encrypting: $key"
            encrypted_value=$(encrypt_value "$value" "$MASTER_KEY")
            echo "$key=$encrypted_value" >> "$NEW_ENV_FILE"
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
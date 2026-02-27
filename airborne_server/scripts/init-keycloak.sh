#!/bin/sh
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

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_DEPS_DIR="${SCRIPT_DIR}/.python-tools"
PYTHON_BIN=""

if [ -f .env ]; then
    set -a
    . .env
    set +a
fi

# Check if encryption is enabled
USE_ENCRYPTION="${USE_ENCRYPTED_SECRETS:-true}"
MASTERKEY_FILE=".masterkey.local"

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin

echo "${YELLOW}🔑 Keycloak Host:${NC} ${GREEN}${KEYCLOAK_URL}${NC}"
echo "${YELLOW}🏛️ Realm:${NC} ${GREEN}${KEYCLOAK_REALM}${NC}"
echo "${YELLOW}🆔 Client ID:${NC} ${GREEN}${KEYCLOAK_CLIENT_ID}${NC}"

echo "${YELLOW}🎫 Getting admin token...${NC}"
ADMIN_TOKEN_RESPONSE=$(curl -v -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USERNAME}" \
  -d "password=${ADMIN_PASSWORD}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")
# echo "${YELLOW}📡 Token response:${NC} $ADMIN_TOKEN_RESPONSE"

ADMIN_TOKEN=$(echo "$ADMIN_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -z "$ADMIN_TOKEN" ]; then
    echo "${RED}❌ ERROR: Failed to get admin token${NC}"
    exit 1
fi
echo "${GREEN}✅ Successfully got admin token!${NC}"

echo "${YELLOW}🔍 Getting client UUID for client ID: ${KEYCLOAK_CLIENT_ID}...${NC}"
CLIENT_LIST_RESPONSE=$(curl -s "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/clients" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")
# echo "${YELLOW}📋 Client list response:${NC} $CLIENT_LIST_RESPONSE"

CLIENT_UUID=$(echo "$CLIENT_LIST_RESPONSE" | jq -r --arg cid "$KEYCLOAK_CLIENT_ID" '.[] | select(.clientId == $cid) | .id')
if [ -z "$CLIENT_UUID" ]; then
    echo "${RED}❌ ERROR: Failed to get client UUID for client: ${KEYCLOAK_CLIENT_ID}${NC}"
    exit 1
fi
echo "${GREEN}✅ Successfully got client UUID: $CLIENT_UUID${NC}"

echo "${YELLOW}🔐 Getting client secret...${NC}"
SECRET_RESPONSE=$(curl -s "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/clients/${CLIENT_UUID}/client-secret" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")
echo "${YELLOW}🔒 Secret response:${NC} $SECRET_RESPONSE"

CLIENT_SECRET=$(echo "$SECRET_RESPONSE" | jq -r '.value // empty')
if [ -z "$CLIENT_SECRET" ]; then
    CLIENT_SECRET=$(echo "$SECRET_RESPONSE" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi
echo "${YELLOW}🔑 Using client secret:${NC} ${GREEN}$CLIENT_SECRET${NC}"

echo "${YELLOW}🗝️ Getting realm public key...${NC}"
REALM_RESPONSE=$(curl -s "${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}")
# echo "${YELLOW}🏛️ Realm response:${NC} $REALM_RESPONSE"

PUBLIC_KEY=$(echo "$REALM_RESPONSE" | grep -o '"public_key":"[^"]*' | cut -d'"' -f4)
echo "${GREEN}✅ Successfully got realm public key!${NC}"

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
        exit 1
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

# Update KEYCLOAK_PUBLIC_KEY (never encrypted)
if grep -q "^KEYCLOAK_PUBLIC_KEY=" ".env"; then
    portable_sed_inplace "s|^KEYCLOAK_PUBLIC_KEY=.*|KEYCLOAK_PUBLIC_KEY=$PUBLIC_KEY|" ".env"
else
    echo "KEYCLOAK_PUBLIC_KEY=$PUBLIC_KEY" >> ".env"
fi

# Handle KEYCLOAK_SECRET based on encryption mode
if [ "$USE_ENCRYPTION" = "true" ]; then
    echo "${YELLOW}🔐 Encryption enabled - encrypting KEYCLOAK_SECRET...${NC}"
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
    
    ENCRYPTED_VALUE=$(printf '%s' "$CLIENT_SECRET" | PYTHONPATH="$PYTHON_DEPS_DIR${PYTHONPATH:+:$PYTHONPATH}" \
        "$PYTHON_BIN" "$SCRIPT_DIR/aes_gcm_encrypt.py" "$MASTER_KEY")
    
    # Update .env with encrypted value
    upsert_env_var ".env" "KEYCLOAK_SECRET" "$ENCRYPTED_VALUE"
    
    # Also save to .env.generated for reference
    if [ ! -f .env.generated ]; then
        touch .env.generated
    fi
    upsert_env_var ".env.generated" "KEYCLOAK_SECRET" "$CLIENT_SECRET"
    
    echo "${GREEN}✅ KEYCLOAK_SECRET encrypted and added to .env${NC}"
else
    echo "${YELLOW}📝 Encryption disabled - saving plaintext KEYCLOAK_SECRET...${NC}"
    
    # Save plaintext to .env
    upsert_env_var ".env" "KEYCLOAK_SECRET" "$CLIENT_SECRET"
    
    # Also save to .env.generated
    if [ ! -f .env.generated ]; then
        touch .env.generated
    fi
    upsert_env_var ".env.generated" "KEYCLOAK_SECRET" "$CLIENT_SECRET"
    
    echo "${GREEN}✅ KEYCLOAK_SECRET saved as plaintext${NC}"
fi

echo "${GREEN}✅ Successfully added the ENVs to .env and .env.generated file!${NC}"

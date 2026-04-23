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

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -f .env ]; then
    set -a
    . .env
    set +a
fi

USE_ENCRYPTION="${USE_ENCRYPTED_SECRETS:-true}"
MASTERKEY_FILE=".masterkey.local"

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin

if [ -z "${OIDC_ISSUER_URL}" ]; then
    if [ -n "${AUTH_ADMIN_ISSUER}" ]; then
        OIDC_ISSUER_URL="${AUTH_ADMIN_ISSUER}"
    elif [ -n "${KEYCLOAK_URL}" ] && [ -n "${KEYCLOAK_REALM}" ]; then
        OIDC_ISSUER_URL="${KEYCLOAK_URL%/}/realms/${KEYCLOAK_REALM}"
    fi
fi

if [ -z "${OIDC_CLIENT_ID}" ] && [ -n "${KEYCLOAK_CLIENT_ID}" ]; then
    OIDC_CLIENT_ID="${KEYCLOAK_CLIENT_ID}"
fi

if [ -z "${OIDC_ISSUER_URL}" ]; then
    echo "${RED}ERROR: OIDC_ISSUER_URL must be set (or provide AUTH_ADMIN_ISSUER / KEYCLOAK_URL+KEYCLOAK_REALM for fallback)${NC}"
    exit 1
fi

if [ -z "${OIDC_CLIENT_ID}" ]; then
    echo "${RED}ERROR: OIDC_CLIENT_ID must be set (or provide KEYCLOAK_CLIENT_ID for fallback)${NC}"
    exit 1
fi

if [ -z "${AUTH_ADMIN_CLIENT_ID}" ]; then
    AUTH_ADMIN_CLIENT_ID="${OIDC_CLIENT_ID}"
fi

ISSUER_TRIMMED="${OIDC_ISSUER_URL%/}"
if ! printf '%s' "$ISSUER_TRIMMED" | grep -q "/realms/"; then
    echo "${RED}ERROR: OIDC_ISSUER_URL must contain /realms/{realm}${NC}"
    exit 1
fi

KC_BASE_URL="${ISSUER_TRIMMED%/realms/*}"
KC_REALM="${ISSUER_TRIMMED##*/realms/}"
KC_REALM="${KC_REALM%%/*}"

if [ -z "${AUTH_ADMIN_ISSUER}" ]; then
    AUTH_ADMIN_ISSUER="${ISSUER_TRIMMED}"
fi
if [ -z "${AUTH_ADMIN_TOKEN_URL}" ]; then
    AUTH_ADMIN_TOKEN_URL="${KC_BASE_URL}/realms/${KC_REALM}/protocol/openid-connect/token"
fi

echo "${YELLOW}Keycloak host:${NC} ${GREEN}${KC_BASE_URL}${NC}"
echo "${YELLOW}Realm:${NC} ${GREEN}${KC_REALM}${NC}"
echo "${YELLOW}OIDC client id:${NC} ${GREEN}${OIDC_CLIENT_ID}${NC}"
echo "${YELLOW}Admin client id:${NC} ${GREEN}${AUTH_ADMIN_CLIENT_ID}${NC}"

echo "${YELLOW}Getting admin token...${NC}"
ADMIN_TOKEN_RESPONSE=$(curl -s -X POST "${KC_BASE_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USERNAME}" \
  -d "password=${ADMIN_PASSWORD}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

ADMIN_TOKEN=$(echo "$ADMIN_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -z "$ADMIN_TOKEN" ]; then
    echo "${RED}ERROR: Failed to get admin token${NC}"
    exit 1
fi

echo "${YELLOW}Fetching clients from Keycloak...${NC}"
CLIENT_LIST_RESPONSE=$(curl -s "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

get_client_uuid() {
    local client_id="$1"
    echo "$CLIENT_LIST_RESPONSE" | jq -r --arg cid "$client_id" '.[] | select(.clientId == $cid) | .id'
}

get_client_secret() {
    local client_id="$1"
    local client_uuid
    local secret_response
    local client_secret

    client_uuid=$(get_client_uuid "$client_id")
    if [ -z "$client_uuid" ] || [ "$client_uuid" = "null" ]; then
        echo "${RED}ERROR: Failed to find client UUID for client: ${client_id}${NC}" >&2
        return 1
    fi

    secret_response=$(curl -s "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients/${client_uuid}/client-secret" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}")

    client_secret=$(echo "$secret_response" | jq -r '.value // empty')
    if [ -z "$client_secret" ]; then
        client_secret=$(echo "$secret_response" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    fi

    if [ -z "$client_secret" ]; then
        echo "${RED}ERROR: Failed to read client secret for client: ${client_id}${NC}" >&2
        return 1
    fi

    echo "$client_secret"
}

OIDC_CLIENT_SECRET_VALUE=$(get_client_secret "$OIDC_CLIENT_ID")
if [ "$AUTH_ADMIN_CLIENT_ID" = "$OIDC_CLIENT_ID" ]; then
    AUTH_ADMIN_CLIENT_SECRET_VALUE="$OIDC_CLIENT_SECRET_VALUE"
else
    AUTH_ADMIN_CLIENT_SECRET_VALUE=$(get_client_secret "$AUTH_ADMIN_CLIENT_ID")
fi

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
        echo "${RED}ERROR: No Python interpreter with SSL support was found${NC}" >&2
        exit 1
    fi

    if "$PYTHON_BIN" -c 'from cryptography.hazmat.primitives.ciphers.aead import AESGCM' >/dev/null 2>&1; then
        return 0
    fi

    if PYTHONPATH="$PYTHON_DEPS_DIR${PYTHONPATH:+:$PYTHONPATH}" "$PYTHON_BIN" -c 'from cryptography.hazmat.primitives.ciphers.aead import AESGCM' >/dev/null 2>&1; then
        return 0
    fi

    echo "${YELLOW}Installing Python cryptography dependency...${NC}"
    mkdir -p "$PYTHON_DEPS_DIR"
    "$PYTHON_BIN" -m pip install --quiet --target "$PYTHON_DEPS_DIR" cryptography
}

shell_quote() {
    local value="$1"
    printf "'%s'" "$(printf '%s' "$value" | sed "s/'/'\\''/g")"
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

if [ ! -f .env.generated ]; then
    touch .env.generated
fi

upsert_env_var ".env" "AUTH_ADMIN_CLIENT_ID" "$AUTH_ADMIN_CLIENT_ID"
upsert_env_var ".env" "AUTH_ADMIN_TOKEN_URL" "$AUTH_ADMIN_TOKEN_URL"
upsert_env_var ".env" "AUTH_ADMIN_ISSUER" "$AUTH_ADMIN_ISSUER"
upsert_env_var ".env" "OIDC_ISSUER_URL" "$OIDC_ISSUER_URL"
upsert_env_var ".env" "OIDC_CLIENT_ID" "$OIDC_CLIENT_ID"

upsert_env_var ".env.generated" "AUTH_ADMIN_CLIENT_ID" "$AUTH_ADMIN_CLIENT_ID"
upsert_env_var ".env.generated" "AUTH_ADMIN_TOKEN_URL" "$AUTH_ADMIN_TOKEN_URL"
upsert_env_var ".env.generated" "AUTH_ADMIN_ISSUER" "$AUTH_ADMIN_ISSUER"
upsert_env_var ".env.generated" "OIDC_ISSUER_URL" "$OIDC_ISSUER_URL"
upsert_env_var ".env.generated" "OIDC_CLIENT_ID" "$OIDC_CLIENT_ID"

if [ "$USE_ENCRYPTION" = "true" ]; then
    echo "${YELLOW}Encryption enabled, encrypting auth client secrets...${NC}"
    ensure_python_crypto

    if [ ! -f "$MASTERKEY_FILE" ]; then
        MASTER_KEY=$(openssl rand -hex 32)
        echo "$MASTER_KEY" > "$MASTERKEY_FILE"
        chmod 600 "$MASTERKEY_FILE"
    else
        MASTER_KEY=$(cat "$MASTERKEY_FILE")
    fi

    encrypt_value() {
        local value="$1"
        printf '%s' "$value" | PYTHONPATH="$PYTHON_DEPS_DIR${PYTHONPATH:+:$PYTHONPATH}" \
            "$PYTHON_BIN" "$SCRIPT_DIR/aes_gcm_encrypt.py" "$MASTER_KEY"
    }

    OIDC_CLIENT_SECRET_ENCRYPTED=$(encrypt_value "$OIDC_CLIENT_SECRET_VALUE")
    AUTH_ADMIN_CLIENT_SECRET_ENCRYPTED=$(encrypt_value "$AUTH_ADMIN_CLIENT_SECRET_VALUE")

    upsert_env_var ".env" "OIDC_CLIENT_SECRET" "$OIDC_CLIENT_SECRET_ENCRYPTED"
    upsert_env_var ".env" "AUTH_ADMIN_CLIENT_SECRET" "$AUTH_ADMIN_CLIENT_SECRET_ENCRYPTED"

    upsert_env_var ".env.generated" "OIDC_CLIENT_SECRET" "$OIDC_CLIENT_SECRET_VALUE"
    upsert_env_var ".env.generated" "AUTH_ADMIN_CLIENT_SECRET" "$AUTH_ADMIN_CLIENT_SECRET_VALUE"

    echo "${GREEN}Encrypted OIDC_CLIENT_SECRET and AUTH_ADMIN_CLIENT_SECRET${NC}"
else
    echo "${YELLOW}Encryption disabled, writing plaintext auth client secrets...${NC}"

    upsert_env_var ".env" "OIDC_CLIENT_SECRET" "$OIDC_CLIENT_SECRET_VALUE"
    upsert_env_var ".env" "AUTH_ADMIN_CLIENT_SECRET" "$AUTH_ADMIN_CLIENT_SECRET_VALUE"

    upsert_env_var ".env.generated" "OIDC_CLIENT_SECRET" "$OIDC_CLIENT_SECRET_VALUE"
    upsert_env_var ".env.generated" "AUTH_ADMIN_CLIENT_SECRET" "$AUTH_ADMIN_CLIENT_SECRET_VALUE"

    echo "${GREEN}Saved plaintext OIDC_CLIENT_SECRET and AUTH_ADMIN_CLIENT_SECRET${NC}"
fi

echo "${GREEN}Updated auth env values in .env and .env.generated${NC}"

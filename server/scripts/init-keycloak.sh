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

if [ -f .env ]; then
    set -a
    . .env
    set +a
fi

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

if grep -q "^KEYCLOAK_PUBLIC_KEY=" ".env"; then
    portable_sed_inplace "s|^KEYCLOAK_PUBLIC_KEY=.*|KEYCLOAK_PUBLIC_KEY=$PUBLIC_KEY|" ".env"
else
    echo "KEYCLOAK_PUBLIC_KEY=$PUBLIC_KEY" >> ".env"
fi

if [ ! -f .env.generated ]; then
    touch .env.generated
fi

if grep -q "^KEYCLOAK_SECRET=" ".env.generated"; then
    portable_sed_inplace "s|^KEYCLOAK_SECRET=.*|KEYCLOAK_SECRET=$CLIENT_SECRET|" ".env.generated"
else
    echo "KEYCLOAK_SECRET=$CLIENT_SECRET" >> ".env.generated"
fi

source ".env.generated"

echo "${GREEN}✅ Successfully added the ENVs to .env and .env.generated file!${NC}"
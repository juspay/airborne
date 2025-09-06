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

SUPERPOSITION_DEFAULT_ORG_NAME=DefaultHyperOTAOrg
SUPERPOSITION_ORG_ADMIN_EMAIL=system@example.com

echo "${YELLOW}📊 Superposition API URL:${NC} ${GREEN}$SUPERPOSITION_URL${NC}"
echo "${YELLOW}🏢 Default Org Name:${NC} ${GREEN}$SUPERPOSITION_DEFAULT_ORG_NAME${NC}"
echo "${YELLOW}👤 Org Admin Email:${NC} ${GREEN}$SUPERPOSITION_ORG_ADMIN_EMAIL${NC}"

echo "${YELLOW}🔍 Checking if organization '$SUPERPOSITION_DEFAULT_ORG_NAME' already exists...${NC}"
ORG_LIST_RESPONSE=$(curl -s -w "HTTPCODE:%{http_code}" -X GET "$SUPERPOSITION_URL/superposition/organisations?all=true")
ORG_LIST_BODY=$(echo "$ORG_LIST_RESPONSE" | sed 's/HTTPCODE:.*$//')
ORG_LIST_HTTP_CODE=$(echo "$ORG_LIST_RESPONSE" | sed -n 's/.*HTTPCODE:\([0-9]*\)$/\1/p')

if [ "$ORG_LIST_HTTP_CODE" = "200" ]; then
    ORG_ID=$(echo "$ORG_LIST_BODY" | jq -r --arg NAME "$SUPERPOSITION_DEFAULT_ORG_NAME" '.data[] | select(.name == $NAME) | .id' | head -n 1)
    if [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ]; then
        echo "${GREEN}✅ Organization '$SUPERPOSITION_DEFAULT_ORG_NAME' already exists with ID: $ORG_ID${NC}"
    else
        echo "${YELLOW}🔧 Organization '$SUPERPOSITION_DEFAULT_ORG_NAME' does not exist. Creating it...${NC}"
        
        CREATE_PAYLOAD=$(cat <<EOF
{
    "name": "$SUPERPOSITION_DEFAULT_ORG_NAME",
    "admin_email": "$SUPERPOSITION_ORG_ADMIN_EMAIL",
    "country_code": "US",
    "contact_email": "$SUPERPOSITION_ORG_ADMIN_EMAIL",
    "contact_phone": "0000000000",
    "sector": "Technology"
}
EOF
)
        echo "${YELLOW}📝 Creation payload:${NC} $CREATE_PAYLOAD"
        
        RESPONSE=$(curl -s -w "HTTPCODE:%{http_code}" -X POST "$SUPERPOSITION_URL/superposition/organisations" \
            -H "Content-Type: application/json" \
            -d "$CREATE_PAYLOAD")
        
        BODY=$(echo "$RESPONSE" | sed 's/HTTPCODE:.*$//')
        HTTP_CODE=$(echo "$RESPONSE" | sed -n 's/.*HTTPCODE:\([0-9]*\)$/\1/p')

        echo "${YELLOW}📡 Superposition API response body:${NC} $BODY"
        echo "${YELLOW}📊 Superposition API response HTTP code:${NC} $HTTP_CODE"

        if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
            ORG_ID=$(echo "$BODY" | jq -r '.id')
            if [ -z "$ORG_ID" ] || [ "$ORG_ID" == "null" ]; then
                echo "${RED}❌ ERROR: Failed to parse organization ID from Superposition response.${NC}"
                echo "${RED}Response body: $BODY${NC}"
                exit 1
            fi
            echo "${GREEN}✅ Successfully created organization '$SUPERPOSITION_DEFAULT_ORG_NAME' with ID: $ORG_ID${NC}"
        else
            echo "${RED}❌ ERROR: Failed to create organization in Superposition. HTTP Status: $HTTP_CODE${NC}"
            echo "${RED}Response body: $BODY${NC}"
            exit 1
        fi
    fi
else
    echo "${RED}❌ ERROR: Failed to list organizations. HTTP Status: $ORG_LIST_HTTP_CODE${NC}"
    exit 1
fi

if grep -q "^SUPERPOSITION_ORG_ID=" ".env"; then
    sed -i "/^SUPERPOSITION_ORG_ID=/c\SUPERPOSITION_ORG_ID=$ORG_ID" ".env"
else
    echo "SUPERPOSITION_ORG_ID=$ORG_ID" >> ".env"
fi
source ".env"

echo "${GREEN}✅ Successfully wrote SUPERPOSITION_ORG_ID to .env file!${NC}"
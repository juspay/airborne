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

if [ -f .env ]; then
    set -a
    . .env
    set +a
fi

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

echo "${YELLOW}🔐 Encrypting sensitive environment variables...${NC}"

# Variables that need encryption
SENSITIVE_VARS=("DB_PASSWORD:.env.example" "DB_MIGRATION_PASSWORD:.env.example" "KEYCLOAK_SECRET:.env.generated")

encrypt_sensitive_var() {
  local sensitive="$1"
  local env_file="$2"

  echo "${YELLOW}🔐 Encrypting ${sensitive} from $env_file...${NC}"

  VALUE=$(grep "^${sensitive}=" "$env_file" | cut -d'=' -f2-)
  TMP_FILE=$(mktemp)
  printf "%s" "$VALUE" > "$TMP_FILE"

  ENCRYPTED_VALUE=$(aws --endpoint-url=${AWS_ENDPOINT_URL} kms encrypt \
    --key-id "$KMS_KEY_ID" \
    --plaintext fileb://"$TMP_FILE" \
    --query CiphertextBlob \
    --output text)

  rm "$TMP_FILE"

  if grep -q "^${sensitive}=" ".env"; then
    portable_sed_inplace "s|^${sensitive}=.*|${sensitive}=$ENCRYPTED_VALUE|" ".env"
  else
      echo "${sensitive}=$ENCRYPTED_VALUE" >> ".env"
  fi
  echo "${GREEN}✅ ${sensitive} encrypted and updated${NC}"
}

encrypt_sensitive_var "DB_PASSWORD" ".env.example"
encrypt_sensitive_var "DB_MIGRATION_PASSWORD" ".env.example"
encrypt_sensitive_var "KEYCLOAK_SECRET" ".env.generated"

echo "${GREEN}✅ Successfully encrypted all sensitive variables to .env file${NC}"


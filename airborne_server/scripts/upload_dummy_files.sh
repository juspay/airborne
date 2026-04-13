#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Upload dummy files to Airborne using the /file/upload endpoint.

Usage:
  upload_dummy_files.sh --organisation ORG --application APP [options]

Options:
  --server-url URL       Base server URL (default: http://localhost:8081)
  --path-prefix PREFIX   API path prefix (default: api)
  --organisation ORG     Organisation header value (required)
  --application APP      Application header value (required)
  --count N              Number of dummy files to upload (default: 100)
  --remote-dir PATH      Remote directory prefix for uploaded file paths
                         (default: dummy/uploads/<timestamp>)
  --tag TAG              File tag query parameter (default: dummy-<timestamp>)
  --token TOKEN          Bearer token for Authorization header
  --username USER        Username for /users/login (used when --token is not set)
  --password PASS        Password for /users/login (used when --token is not set)
  --keep-temp            Keep generated local temp files instead of deleting them
  -h, --help             Show this help

Examples:
  ./airborne_server/scripts/upload_dummy_files.sh \
    --organisation my-org \
    --application my-app \
    --token "$AB_TOKEN"

  ./airborne_server/scripts/upload_dummy_files.sh \
    --organisation my-org \
    --application my-app \
    --username admin \
    --password admin
USAGE
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command not found: $cmd" >&2
    exit 1
  fi
}

extract_access_token() {
  local json_input="$1"

  if command -v jq >/dev/null 2>&1; then
    jq -r '.user_token.access_token // .access_token // empty' <<<"$json_input"
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json,sys
obj=json.load(sys.stdin)
token=""
if isinstance(obj, dict):
    if isinstance(obj.get("user_token"), dict):
        token=obj["user_token"].get("access_token","")
    if not token:
        token=obj.get("access_token","")
print(token)
' <<<"$json_input"
    return
  fi

  printf '%s' "$json_input" | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | cut -d'"' -f4
}

SERVER_URL="${SERVER_URL:-http://localhost:8081}"
PATH_PREFIX="${PATH_PREFIX:-api}"
ORGANISATION="${AIRBORNE_ORGANISATION:-}"
APPLICATION="${AIRBORNE_APPLICATION:-}"
COUNT=100
RUN_ID="$(date +%Y%m%d%H%M%S)"
REMOTE_DIR="dummy/uploads/${RUN_ID}"
TAG="dummy-${RUN_ID}"
TOKEN="${AIRBORNE_TOKEN:-${AB_TOKEN:-}}"
USERNAME="${AIRBORNE_USERNAME:-}"
PASSWORD="${AIRBORNE_PASSWORD:-}"
KEEP_TEMP=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-url)
      SERVER_URL="$2"
      shift 2
      ;;
    --path-prefix)
      PATH_PREFIX="$2"
      shift 2
      ;;
    --organisation)
      ORGANISATION="$2"
      shift 2
      ;;
    --application)
      APPLICATION="$2"
      shift 2
      ;;
    --count)
      COUNT="$2"
      shift 2
      ;;
    --remote-dir)
      REMOTE_DIR="$2"
      shift 2
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --username)
      USERNAME="$2"
      shift 2
      ;;
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    --keep-temp)
      KEEP_TEMP=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$ORGANISATION" ]]; then
  echo "Error: --organisation is required" >&2
  exit 1
fi

if [[ -z "$APPLICATION" ]]; then
  echo "Error: --application is required" >&2
  exit 1
fi

if ! [[ "$COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: --count must be a positive integer" >&2
  exit 1
fi

require_cmd curl
require_cmd openssl
require_cmd mktemp
require_cmd seq

BASE_URL="${SERVER_URL%/}/${PATH_PREFIX#/}"

if [[ -z "$TOKEN" ]]; then
  if [[ -z "$USERNAME" || -z "$PASSWORD" ]]; then
    cat >&2 <<ERR
Error: authentication missing.
Provide either:
  1) --token
  2) --username and --password (script will call ${BASE_URL}/users/login)
ERR
    exit 1
  fi

  login_payload="$(printf '{"name":"%s","password":"%s"}' "$USERNAME" "$PASSWORD")"
  login_response="$(curl -sS -w $'\n%{http_code}' \
    -X POST "${BASE_URL}/users/login" \
    -H "Content-Type: application/json" \
    -d "$login_payload")"
  login_code="${login_response##*$'\n'}"
  login_body="${login_response%$'\n'*}"

  if [[ ! "$login_code" =~ ^2[0-9][0-9]$ ]]; then
    echo "Error: login failed with HTTP ${login_code}" >&2
    echo "$login_body" >&2
    exit 1
  fi

  TOKEN="$(extract_access_token "$login_body" || true)"
  if [[ -z "$TOKEN" ]]; then
    echo "Error: login succeeded but could not parse access token" >&2
    echo "$login_body" >&2
    exit 1
  fi
fi

TMP_DIR="$(mktemp -d -t airborne-dummy-upload-XXXXXX)"
cleanup() {
  if [[ "${KEEP_TEMP}" -eq 0 ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

echo "Uploading ${COUNT} dummy files to ${BASE_URL}/file/upload"
echo "Organisation: ${ORGANISATION}"
echo "Application:  ${APPLICATION}"
echo "Remote dir:   ${REMOTE_DIR}"
echo "Tag:          ${TAG}"
echo "Temp dir:     ${TMP_DIR}"

uploaded=0
failed=0

for i in $(seq 1 "$COUNT"); do
  file_num="$(printf '%03d' "$i")"
  filename="dummy_${file_num}.txt"
  local_path="${TMP_DIR}/${filename}"
  remote_path="${REMOTE_DIR}/${filename}"

  {
    printf 'dummy_file=%s\n' "$filename"
    printf 'index=%s\n' "$file_num"
    printf 'run_id=%s\n' "$RUN_ID"
    printf 'generated_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'random=%s\n' "$RANDOM$RANDOM"
  } >"$local_path"

  checksum_b64="$(openssl dgst -sha256 -binary "$local_path" | openssl base64 -A)"
  upload_url="${BASE_URL}/file/upload?file_path=${remote_path}&tag=${TAG}"

  response="$(curl -sS -w $'\n%{http_code}' \
    -X POST "$upload_url" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "x-organisation: ${ORGANISATION}" \
    -H "x-application: ${APPLICATION}" \
    -H "x-checksum: ${checksum_b64}" \
    --data-binary "@${local_path}")"

  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
    uploaded=$((uploaded + 1))
    echo "[$i/${COUNT}] Uploaded ${remote_path}"
  else
    failed=$((failed + 1))
    echo "[$i/${COUNT}] Failed ${remote_path} (HTTP ${http_code})" >&2
    echo "$body" >&2
  fi
done

echo

echo "Upload summary:"
echo "  Uploaded: ${uploaded}"
echo "  Failed:   ${failed}"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi

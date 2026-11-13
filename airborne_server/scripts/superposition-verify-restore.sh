#!/usr/bin/env bash
# Restore a backup into a private, disposable PostgreSQL container and verify it.
set -Eeuo pipefail
umask 077

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-directory>" >&2
  exit 2
fi
BACKUP_DIR="$(cd "$1" && pwd -P)"
for file in config.dump airborne.dump globals.sql inventory.tsv counts.tsv metadata.txt SHA256SUMS; do
  if [[ ! -f "$BACKUP_DIR/$file" ]]; then
    echo "Backup is missing $file: $BACKUP_DIR" >&2
    exit 1
  fi
done
if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

(cd "$BACKUP_DIR" && shasum -a 256 -c SHA256SUMS)
IMAGE="$(sed -n 's/^source_image=//p' "$BACKUP_DIR/metadata.txt")"
DATABASE="$(sed -n 's/^database=//p' "$BACKUP_DIR/metadata.txt")"
SOURCE_VERSION="$(sed -n 's/^postgres_version=//p' "$BACKUP_DIR/metadata.txt")"
DATABASE_ENCODING="$(sed -n 's/^database_encoding=//p' "$BACKUP_DIR/metadata.txt")"
DATABASE_COLLATE="$(sed -n 's/^database_collate=//p' "$BACKUP_DIR/metadata.txt")"
DATABASE_CTYPE="$(sed -n 's/^database_ctype=//p' "$BACKUP_DIR/metadata.txt")"
if [[ "$IMAGE" != ghcr.io/juspay/superposition-demo:0.113.0 || "$DATABASE" != config ]]; then
  echo "This restore verifier expects ghcr.io/juspay/superposition-demo:0.113.0 and database config" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CONTAINER="airborne-superposition-restore-$STAMP-$$"
CREATED=false
VERIFY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/superposition-restore.XXXXXX")"
cleanup() {
  if [[ -d "$VERIFY_DIR" ]]; then
    rm -r "$VERIFY_DIR"
  fi
  if [[ "$CREATED" == true ]]; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Refusing to reuse existing container '$CONTAINER'" >&2
  exit 1
fi

# The container has no host ports or network and is never the live service.
docker run --detach --rm --name "$CONTAINER" --network none \
  --entrypoint /bin/bash "$IMAGE" -lc 'service postgresql start >/dev/null && exec sleep infinity' >/dev/null
CREATED=true

READY=false
for ((attempt = 0; attempt < 60; attempt++)); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
done
if [[ "$READY" != true ]]; then
  echo "PostgreSQL did not become ready in disposable container '$CONTAINER'" >&2
  exit 1
fi

docker cp "$BACKUP_DIR/globals.sql" "$CONTAINER:/tmp/superposition-globals.sql" >/dev/null
docker cp "$BACKUP_DIR/config.dump" "$CONTAINER:/tmp/superposition-config.dump" >/dev/null
# initdb already creates the built-in postgres role in a fresh cluster.
docker exec "$CONTAINER" sed -i '/^CREATE ROLE postgres;$/d' /tmp/superposition-globals.sql
docker exec "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/superposition-globals.sql >/dev/null
docker exec "$CONTAINER" dropdb -U postgres --if-exists --force "$DATABASE"
docker exec "$CONTAINER" createdb -U postgres --template=template0 --encoding="$DATABASE_ENCODING" \
  --lc-collate="$DATABASE_COLLATE" --lc-ctype="$DATABASE_CTYPE" "$DATABASE"
docker exec "$CONTAINER" pg_restore -U postgres --exit-on-error --no-owner --dbname="$DATABASE" /tmp/superposition-config.dump

RESTORE_VERSION="$(docker exec "$CONTAINER" psql -U postgres -d postgres -Atc 'SHOW server_version')"
if [[ "${RESTORE_VERSION%%.*}" != "${SOURCE_VERSION%%.*}" ]]; then
  echo "PostgreSQL major version mismatch: backup is $SOURCE_VERSION, restore is $RESTORE_VERSION" >&2
  exit 1
fi

docker exec "$CONTAINER" psql -U postgres -d "$DATABASE" -At -F $'\t' -c \
  "SELECT 'organisation', id, name, '' FROM superposition.organisations
   UNION ALL
   SELECT 'workspace', organisation_id, workspace_name, workspace_schema_name FROM superposition.workspaces
   ORDER BY 1, 2, 3, 4" > "$VERIFY_DIR/inventory.tsv"
docker exec "$CONTAINER" psql -U postgres -d "$DATABASE" -At -F $'\t' -c \
  "SELECT
     (SELECT count(*) FROM superposition.organisations),
     (SELECT count(*) FROM superposition.workspaces),
     (SELECT COALESCE(sum(((xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.experiments', workspace_schema_name), false, true, '')))[1]::text)::bigint), 0)
        FROM superposition.workspaces)" > "$VERIFY_DIR/counts.tsv"

if ! cmp -s "$BACKUP_DIR/inventory.tsv" "$VERIFY_DIR/inventory.tsv"; then
  echo "Restored organisation/workspace inventory differs from the live post-dump inventory (informational; snapshots differ)" >&2
  diff -u "$BACKUP_DIR/inventory.tsv" "$VERIFY_DIR/inventory.tsv" || true
fi
if ! cmp -s "$BACKUP_DIR/counts.tsv" "$VERIFY_DIR/counts.tsv"; then
  echo "Restored organisation/workspace/experiment counts differ from the live post-dump counts (informational; snapshots differ)" >&2
  echo "Backup:  $(cat "$BACKUP_DIR/counts.tsv")" >&2
  echo "Restore: $(cat "$VERIFY_DIR/counts.tsv")" >&2
fi

IFS=$'\t' read -r ORGANISATIONS WORKSPACES EXPERIMENTS < "$VERIFY_DIR/counts.tsv"
printf 'config.dump restored and verified; airborne.dump checksummed only: %s\n' "$BACKUP_DIR"
printf 'Restored image: %s (PostgreSQL %s)\n' "$IMAGE" "$RESTORE_VERSION"
printf 'Restored inventory: %s organisations, %s workspaces\n' "$ORGANISATIONS" "$WORKSPACES"
printf 'Restored experiment count across workspace schemas: %s\n' "$EXPERIMENTS"
printf 'Disposable container: %s (removed on exit)\n' "$CONTAINER"

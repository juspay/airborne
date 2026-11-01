#!/usr/bin/env bash
# Create a consistent PostgreSQL backup of the embedded Superposition database.
set -Eeuo pipefail
umask 077

SOURCE_CONTAINER="${SUPERPOSITION_CONTAINER:-superposition}"
DATABASE="${SUPERPOSITION_DATABASE:-config}"
AIRBORNE_CONTAINER="${AIRBORNE_POSTGRES_CONTAINER:-hyper-ota-postgres}"
AIRBORNE_DATABASE="${AIRBORNE_POSTGRES_DATABASE:-hyperotaserver}"
BACKUP_ROOT="${AIRBORNE_SUPERPOSITION_BACKUP_DIR:-${HOME}/airborne-superposition-backups}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi
if ! docker inspect "$SOURCE_CONTAINER" >/dev/null 2>&1; then
  echo "Superposition container '$SOURCE_CONTAINER' is not present" >&2
  exit 1
fi
if [[ "$(docker inspect -f '{{.State.Running}}' "$SOURCE_CONTAINER")" != true ]]; then
  echo "Superposition container '$SOURCE_CONTAINER' is not running" >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
BACKUP_ROOT="$(cd "$BACKUP_ROOT" && pwd -P)"
case "$BACKUP_ROOT/" in
  "$REPO_ROOT/"*)
    echo "Backup directory must be outside the repository: $BACKUP_ROOT" >&2
    exit 1
    ;;
esac

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_DIR="$BACKUP_ROOT/superposition-$STAMP"
WORK_DIR="$BACKUP_ROOT/.superposition-$STAMP-$$.tmp"
mkdir "$WORK_DIR"
cleanup() {
  if [[ -d "$WORK_DIR" ]]; then
    rm -r "$WORK_DIR"
  fi
}
trap cleanup EXIT

IMAGE="$(docker inspect -f '{{.Config.Image}}' "$SOURCE_CONTAINER")"
PG_VERSION="$(docker exec "$SOURCE_CONTAINER" psql -U postgres -d postgres -Atc 'SHOW server_version')"
DATA_DIRECTORY="$(docker exec "$SOURCE_CONTAINER" psql -U postgres -d postgres -Atc 'SHOW data_directory')"
DATA_OWNERSHIP="$(docker exec "$SOURCE_CONTAINER" stat -c '%u:%g %a' "$DATA_DIRECTORY")"
DATABASE_OWNER="$(docker exec "$SOURCE_CONTAINER" psql -U postgres -d postgres -Atc "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$DATABASE'")"
DATABASE_SETTINGS="$(docker exec "$SOURCE_CONTAINER" psql -U postgres -d postgres -At -F $'\t' -c "SELECT pg_encoding_to_char(encoding), datcollate, datctype FROM pg_database WHERE datname = '$DATABASE'")"
if [[ -z "$DATABASE_OWNER" ]]; then
  echo "Database '$DATABASE' was not found in '$SOURCE_CONTAINER'" >&2
  exit 1
fi
IFS=$'\t' read -r DATABASE_ENCODING DATABASE_COLLATE DATABASE_CTYPE <<< "$DATABASE_SETTINGS"

# pg_dump uses one MVCC snapshot for the whole database; no server interruption
# or filesystem-level copy is involved.
docker exec "$SOURCE_CONTAINER" pg_dump -U postgres -Fc --dbname="$DATABASE" > "$WORK_DIR/config.dump"
docker exec "$AIRBORNE_CONTAINER" pg_dump -U "${AIRBORNE_POSTGRES_USER:-postgres}" -Fc --dbname="$AIRBORNE_DATABASE" > "$WORK_DIR/airborne.dump"
docker exec "$SOURCE_CONTAINER" pg_dumpall -U postgres --globals-only > "$WORK_DIR/globals.sql"

docker exec "$SOURCE_CONTAINER" psql -U postgres -d "$DATABASE" -At -F $'\t' -c \
  "SELECT 'organisation', id, name, '' FROM superposition.organisations
   UNION ALL
   SELECT 'workspace', organisation_id, workspace_name, workspace_schema_name FROM superposition.workspaces
   ORDER BY 1, 2, 3, 4" > "$WORK_DIR/inventory.tsv"

docker exec "$SOURCE_CONTAINER" psql -U postgres -d "$DATABASE" -At -F $'\t' -c \
  "SELECT
     (SELECT count(*) FROM superposition.organisations),
     (SELECT count(*) FROM superposition.workspaces),
     (SELECT COALESCE(sum(((xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.experiments', workspace_schema_name), false, true, '')))[1]::text)::bigint), 0)
        FROM superposition.workspaces)" > "$WORK_DIR/counts.tsv"

cat > "$WORK_DIR/metadata.txt" <<EOF
created_utc=$STAMP
source_container=$SOURCE_CONTAINER
source_image=$IMAGE
airborne_container=$AIRBORNE_CONTAINER
airborne_database=$AIRBORNE_DATABASE
consistency=Stop all release writers for the entire backup window; databases have independent snapshots
database=$DATABASE
database_owner=$DATABASE_OWNER
database_encoding=$DATABASE_ENCODING
database_collate=$DATABASE_COLLATE
database_ctype=$DATABASE_CTYPE
postgres_version=$PG_VERSION
data_directory=$DATA_DIRECTORY
data_directory_uid_gid_mode=$DATA_OWNERSHIP
dump_format=PostgreSQL custom archive (pg_dump -Fc; one consistent MVCC snapshot)
EOF

(cd "$WORK_DIR" && shasum -a 256 config.dump airborne.dump globals.sql inventory.tsv counts.tsv metadata.txt > SHA256SUMS)
chmod 600 "$WORK_DIR"/*
if [[ -e "$FINAL_DIR" ]]; then
  echo "Backup already exists: $FINAL_DIR" >&2
  exit 1
fi
mv "$WORK_DIR" "$FINAL_DIR"
printf 'Backup created: %s\n' "$FINAL_DIR"
du -h "$FINAL_DIR"

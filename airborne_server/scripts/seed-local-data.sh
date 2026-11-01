#!/usr/bin/env bash
# Import STOPPED local containers into empty host directories; never live-copy PG.
set -Eeuo pipefail
umask 077
: "${AIRBORNE_DATA_DIR:?Set AIRBORNE_DATA_DIR to an absolute host path}"
[[ "$AIRBORNE_DATA_DIR" = /* ]] || { echo 'Use an absolute AIRBORNE_DATA_DIR' >&2; exit 1; }
sp="${SUPERPOSITION_CONTAINER:-superposition}"
image=ghcr.io/juspay/superposition-demo:0.113.0
mkdir -p "$AIRBORNE_DATA_DIR"
available=$(df -Pk "$AIRBORNE_DATA_DIR" | awk 'END {print $4}')
(( available >= 5 * 1024 * 1024 )) || { echo 'Less than 5 GiB free; stopping' >&2; exit 1; }
# Preflight BOTH destinations before copying either. A second run refuses data.
for name in superposition localstack; do
  dest="$AIRBORNE_DATA_DIR/$name"
  if [[ -e "$dest" && ( ! -d "$dest" || -n "$(ls -A "$dest")" ) ]]; then
    echo "Refusing to overwrite populated destination: $dest" >&2; exit 1
  fi
done
for container in "$sp"; do
  [[ "$(docker inspect -f '{{.State.Running}}' "$container")" == false ]] || {
    echo "Stop $container cleanly before seeding" >&2; exit 1;
  }
done
[[ "$(docker inspect -f '{{.Config.Image}}' "$sp")" == "$image" ]] || {
  echo "Inspect PostgreSQL path/version before importing a different image" >&2; exit 1;
}
# Old localstack/localstack did not persist its in-memory S3 API state in a
# gresau snapshot. Require an object export made while the old instance runs.
: "${LOCALSTACK_S3_EXPORT:?Export each old bucket into LOCALSTACK_S3_EXPORT/<bucket>/ before stopping it; /var/lib/localstack is not a portable snapshot}"
[[ -d "$LOCALSTACK_S3_EXPORT" ]] || { echo 'Missing S3 export directory' >&2; exit 1; }
# Verify the PG source and export before staging either destination.
docker cp "$sp:/var/lib/postgresql/17/main/PG_VERSION" - >/dev/null
sp_stage=$(mktemp -d "$AIRBORNE_DATA_DIR/.superposition-import.XXXXXX")
ls_stage=$(mktemp -d "$AIRBORNE_DATA_DIR/.localstack-import.XXXXXX")
seed="airborne-localstack-seed-$$"
cleanup() { docker rm -f "$seed" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# This disposable importer has no published ports or network access.
docker run -d --name "$seed" --network none -e SERVICES=s3 \
  -v "$ls_stage:/persisted-data" -v "$LOCALSTACK_S3_EXPORT:/export:ro" gresau/localstack-persist:4@sha256:02045e045f1f3868c3cadef78de2a7c048840f48ffd506babf4a36f42a4845ba >/dev/null
for attempt in {1..60}; do
  docker exec "$seed" awslocal s3 ls >/dev/null 2>&1 && break
  sleep 1
done
for bucket in "$LOCALSTACK_S3_EXPORT"/*; do
  [[ -d "$bucket" ]] || continue
  name=$(basename "$bucket")
  docker exec "$seed" awslocal s3 mb "s3://$name"
  docker exec "$seed" awslocal s3 sync "/export/$name/" "s3://$name/"
done
# A clean stop flushes the new image's own snapshot format.
docker stop "$seed" >/dev/null
cleanup
trap - EXIT
docker cp -a "$sp:/var/lib/postgresql/17/main/." "$sp_stage/"
docker run --rm --network none --entrypoint /bin/bash -v "$sp_stage:/seed" "$image" -ec \
  'test "$(cat /seed/PG_VERSION)" = 17; test -f /seed/global/pg_control; chown -R 100:102 /seed; chmod 0700 /seed; test "$(stat -c "%u:%g %a" /seed)" = "100:102 700"'
for name in superposition localstack; do
  dest="$AIRBORNE_DATA_DIR/$name"
  [[ ! -d "$dest" ]] || rmdir "$dest"
  if [[ "$name" = superposition ]]; then mv "$sp_stage" "$dest"; else mv "$ls_stage" "$dest"; fi
done
printf 'Seeded host data at %s; source containers were not changed.\n' "$AIRBORNE_DATA_DIR"

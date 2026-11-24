---
title: Superposition backup and restore
---

Superposition stores release history in PostgreSQL. The local demo image `ghcr.io/juspay/superposition-demo:0.113.0` ships its database in its writable container layer. The maintained local Compose setup now seeds and mounts a host directory; older containers without that mount lose release history when recreated.

## Back up local Superposition

From the Airborne repository root, run:

```bash
./airborne_server/scripts/superposition-backup.sh
```

By default, the script writes a timestamped directory under `$HOME/airborne-superposition-backups`. Choose another location with `AIRBORNE_SUPERPOSITION_BACKUP_DIR`:

```bash
AIRBORNE_SUPERPOSITION_BACKUP_DIR="$HOME/backups/superposition" \
  ./airborne_server/scripts/superposition-backup.sh
```

The script reads the running `superposition` container with `docker exec`; it does not stop or restart it. It exports the `config` database with `pg_dump -Fc`, which uses one consistent PostgreSQL snapshot, and captures global role definitions. The backup also includes the source image and PostgreSQL version, checksums, an organisation/workspace inventory, and organisation/workspace/experiment counts. The dump and role file can contain sensitive configuration, so keep the directory private and store off-machine copies encrypted.

The backup directory is complete only after the command prints `Backup created`. Do not copy the temporary `.tmp` directory left by an interrupted run.

## Verify a restore locally

Run the restore verifier with the backup directory printed by the backup command:

```bash
./airborne_server/scripts/superposition-verify-restore.sh \
  "$HOME/airborne-superposition-backups/superposition-YYYYMMDDTHHMMSSZ"
```

The verifier checks the backup checksums, starts a uniquely named disposable container from the same pinned Superposition image, starts its PostgreSQL 17.10 server, restores the role and `config` database, and compares the restored organisation/workspace inventory and all workspace experiment counts with the backup metadata. It publishes no ports, has no network, and removes its temporary container when it exits. This verifies the PostgreSQL archive and data; it does not exercise a live Superposition application cutover.

The restore verifier currently accepts backups made from `ghcr.io/juspay/superposition-demo:0.113.0` and database `config`. Recheck the image's PostgreSQL version, data directory, owner, and restore compatibility before changing that pin.

## Host persistence for local deployments

Compose now pins the demo to `0.113.0` by default and bind mounts
`${AIRBORNE_DATA_DIR:-./.airborne-data}/superposition` at
`/var/lib/postgresql/17/main`. Set `AIRBORNE_DATA_DIR` to an absolute host path
in `airborne_server/.env`, for example `/srv/airborne-data`.
The default `.airborne-data` directory is gitignored. Keep it private and backed up.

The image ships an initialized PostgreSQL 17 cluster, owned by UID:GID `100:102`
and mode `0700`. An empty bind mount hides it and fails startup. The one-shot
`superposition-data-init` service seeds an empty directory from the pinned image,
sets ownership and mode, and validates an existing cluster without overwriting it.
An interrupted seed leaves a marker that blocks startup until inspected.
It refuses a populated directory without `PG_VERSION`. Keep the helper and service
on the same version. Reinspect the image before changing versions; do not mount a
PostgreSQL 17 directory into another major version.

### Migrate an existing local stack

Do not start Compose against an empty host directory before importing existing data.
First pause API writers and take a fresh backup with the script above; verify its
checksums and run the restore verifier. While LocalStack is still running, export each bucket into an absolute host
`LOCALSTACK_S3_EXPORT/<bucket>/` directory with `awslocal s3 sync` (use a bind
mount or copy the export onto the host). Record and verify inventory and sizes.
This object export is required; the old LocalStack state directory is not a
portable snapshot. Check free disk space; stop below 5 GiB.
Stop Superposition and LocalStack cleanly, then rename them for rollback:

```bash
docker stop superposition hyper-ota-localstack
docker rename superposition superposition-pre-persistence
docker rename hyper-ota-localstack hyper-ota-localstack-pre-persistence
AIRBORNE_DATA_DIR=/absolute/path/airborne-data \
SUPERPOSITION_CONTAINER=superposition-pre-persistence \
LOCALSTACK_S3_EXPORT=/absolute/path/s3-export \
  ./airborne_server/scripts/seed-local-data.sh
```

The seed script copies PostgreSQL only from a stopped container and imports the
previously exported S3 objects into staging directories,
checks the PostgreSQL version and control file, and sets `100:102` / `0700` through
Docker. It refuses populated destinations on every invocation, so retries never
overwrite data. Failed staging directories remain for inspection. This is a local
cold-copy migration; logical dumps remain the supported backup mechanism.

Renamed containers retain Compose labels. Use a different Compose project during
cutover, connecting it to the existing network and init-data volume. Set
`AIRBORNE_DATA_DIR` to the host storage directory in the new project's environment.
Verify replacements before removing rollback containers.

Compare exact database and S3 inventories, API health, release responses and file
URLs before resuming writes. Test a new database row and S3 object across restart
and recreation. On failure, stop/remove only the replacements, rename the old
containers back and start them, then resume the API. Keep failed host data for
inspection. Never run the old Compose project against renamed rollback containers.

### Durability boundaries

LocalStack uses the pinned `gresau/localstack-persist:4` wrapper with S3 and KMS
persistence, saving into `${AIRBORNE_DATA_DIR:-./.airborne-data}/localstack`.
It saves periodically (one second) and on graceful shutdown. It is **not synchronous
crash-proof S3 durability**: sudden power loss can lose writes since the last save.
PostgreSQL uses its normal WAL recovery, subject to Docker Desktop and host storage
flush behavior. Host directories survive container recreation and machine restarts;
no local disk setup protects against disk loss. Keep independent backups.

`docker compose down` removes containers and networks, but retains these host
directories. `down -v` still deletes Airborne Postgres, Keycloak and other named
volumes; do not use it for a stack whose data you need. Both `hyper-ota-postgres`
and `keycloak-db` already have durable named volumes and were left unchanged.
Deleting the host directories destroys the persisted Superposition/S3 data.

## Production guidance and limits

There is no production Superposition service or database available in this environment, so production backup, restore, version compatibility, roles, and cutover remain **untested**. Do not run these local scripts against production.

For production, use the database provider's supported consistent snapshot or backup mechanism and an additional PostgreSQL logical dump where supported. Encrypt and retain backups according to the service's recovery objectives, and monitor that scheduled backups complete. Before a restore, confirm the exact Superposition image and PostgreSQL major version, required roles, extensions, locale, and encryption settings. Restore into an isolated database or instance first; verify organisations, workspaces, experiment/release history, application connectivity, and service behavior; then use the production change process to switch traffic. No production credentials, version details, isolated destination, or recovery objectives were supplied here, so those operational steps have not been validated.


## Paired Airborne state

The backup includes `airborne.dump` from `AIRBORNE_POSTGRES_CONTAINER` (default `hyper-ota-postgres`), database `AIRBORNE_POSTGRES_DATABASE` (default `hyperotaserver`), user `AIRBORNE_POSTGRES_USER` (default `postgres`). Stop all release writers and migrations across every API instance for the entire backup window. These are separate database snapshots, not an atomic cross-database backup. Pair both dumps with the same S3 artifacts, credentials/signing keys and deployment configuration. Restore both databases to that window before restarting writers; restoring only Superposition can invalidate approval snapshots and rollback journals.

`superposition-verify-restore.sh` is a disposable restore verifier for `config.dump`; it does not install either dump into a live deployment. Restore `airborne.dump` separately with `pg_restore` into a disposable Airborne database and run the matching migrations before a coordinated recovery. Live inventory/count captures happen after the dump and are informational; drift does not mean the archive is corrupt.

The old `superposition-restore.sh` name remains a compatibility wrapper with identical arguments and exit status.

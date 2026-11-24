---
title: Run locally
description: Bring up the Airborne server and all its dependencies for local development with Docker and make.
---

For local development the repository ships a `docker-compose.yml` that provisions every dependency (PostgreSQL, Keycloak + its database, Superposition, Redis + RedisInsight, and LocalStack for S3/KMS), plus a top-level `Makefile` that wires the dependencies, the init scripts, the server, the dashboard, and the docs together. The two commands you need are `make setup` (once) and `make run` (each session).

All commands below are run from the **repository root** unless noted.

## Prerequisites

- **Docker** (or Podman) with Compose. The Makefile auto-detects `docker` or `podman`.
- **Rust toolchain** (the build uses Rust `1.89`) plus [`cargo-watch`](https://crates.io/crates/cargo-watch) for the hot-reload loop.
- **Node.js** (v22 is used for the bundled frontends) and `npm`.
- **Diesel CLI** with the Postgres feature, for running migrations manually:
  ```bash
  cargo install diesel_cli --no-default-features --features postgres
  ```
- **Python 3** with SSL support — the encryption init scripts use it (they auto-install the `cryptography` package into a local folder if needed).
- The AWS CLI is used by the init scripts against LocalStack; the local `awslocal`/`aws` calls run inside containers, so a host AWS CLI is optional.

:::tip
If you use Nix, the repo is set up to provide the toolchain through a dev shell, which covers Rust, Node, and the Diesel CLI in one place. Otherwise install the tools above individually.
:::

## Set up dependencies

`make setup` copies `.env`, starts the dependency containers, and installs frontend dependencies. Concretely it runs the `env-file`, `db`, `superposition`, `keycloak-db`, `keycloak`, `redis`, `redis-insight`, `localstack`, and `node-dependencies` targets:

```bash
make setup
```

What happens:

- **`env-file`** — if `airborne_server/.env` does not exist, it copies `airborne_server/.env.example` to `.env` and appends `airborne_server/.env.docker.extra` (which adds the Postgres/Keycloak/LocalStack/Superposition container settings and ports).
- **`db` / `keycloak-db`** — starts the two Postgres containers and waits for them to accept connections.
- **`superposition`** — starts Superposition and waits for its `/health` to return `200`.
- **`keycloak`** — builds and starts Keycloak (with the realm imported) and waits for it to be healthy.
- **`redis` / `redis-insight`** — starts the Redis cache (published on `REDIS_PORT`, default `6379`) and the optional [RedisInsight](https://redis.io/insight/) UI (default `5540`). The server picks Redis up via `REDIS_URL`. You can start them on their own with `make redis` / `make redis-insight`.
- **`localstack`** — starts LocalStack with the `kms` and `s3` services.
- **`node-dependencies`** — `npm ci` for the dashboard and the bundled docs app.

By default setup uses **encrypted secrets**. To set up in plaintext mode instead:

```bash
make setup USE_ENCRYPTED_SECRETS=false
```

:::note
`make setup` only seeds the `.env` and brings up containers — it does **not** itself run the Superposition / Keycloak / LocalStack *init* scripts. Those run as part of `make run` (and are also available as `make superposition-init`, `make keycloak-init`, `make localstack-init`).
:::

## Run the server

`make run` is the development loop. It kills any stale server process, ensures the dependency containers are up, runs the init scripts, then starts the dashboard, the docs, and the server under `cargo watch`:

```bash
make run
```

This runs three things concurrently:

- **Dashboard** — `npm run dev` in `airborne_dashboard`.
- **Docs** — the bundled docs React app build.
- **Server** — `cargo watch` rebuilds and restarts `airborne_server` whenever the source changes.

Before starting the server, `make run` executes the init scripts, which finalize configuration **in `.env`**:

- `init-superposition.sh` — creates the default Superposition org and writes `SUPERPOSITION_ORG_ID`.
- `init-localstack.sh` — creates the local KMS key (`alias/my-local-key`) and the S3 bucket (with a `GET`/`HEAD` CORS rule so browser clients can fetch OTA files), and (in encrypted mode) KMS-encrypts the master key and the sensitive variables into `.env`.
- `init-keycloak.sh` — reads the realm's client secrets from Keycloak and writes `OIDC_CLIENT_SECRET` / `AUTH_ADMIN_CLIENT_SECRET` (encrypted or plaintext per mode), along with the resolved issuer/token URLs.

The encryption mode used at run time is taken from `USE_ENCRYPTED_SECRETS` in `.env` (falling back to the `make` variable). To run without encryption:

```bash
make run USE_ENCRYPTED_SECRETS=false
```

## Migrations

Database schema is managed with [Diesel](https://diesel.rs/); migrations live in `airborne_server/migrations/` and `diesel.toml` points the generated schema at `src/utils/db/schema.rs`.

There are two ways migrations run:

- **Embedded, on boot** — the binary embeds the migrations (`embed_migrations!`) and runs any pending ones at startup when `MIGRATIONS_TO_RUN_ON_BOOT` includes `db` (the example `.env` sets `db,superposition`). See [boot-time migrations](/docs/server/configuration#boot-time-migrations).
- **Manually, via the CLI** — run them yourself with the Makefile target:
  ```bash
  make db-migration
  ```
  This sources `airborne_server/.env`, constructs `DATABASE_URL` (preferring `DB_URL`/`DATABASE_URL` if present, otherwise assembling it with the default migration password), and runs `diesel migration run` from `airborne_server`.

:::tip
You can run Diesel directly from `airborne_server` once `DATABASE_URL` is exported, e.g. `cd airborne_server && diesel migration run`. The `make db-migration` target just sets that up for you from `.env`.
:::

## Hit the health check

Once the server is up, verify it:

```bash
curl http://localhost:8081/api/health
```

A healthy server returns `200 OK` with `{ "status": "ok" }`. The path is `/{SERVER_PATH_PREFIX}/health`; `SERVER_PATH_PREFIX` defaults to `api`. The server port is `PORT` (default `8081`).

You can also sanity-check the dependencies:

```bash
# Superposition
curl http://localhost:8080/health
# Keycloak realm
curl http://localhost:8180/realms/master
# LocalStack
curl http://localhost:4566/_localstack/health
```

`make status` prints a summary of which containers are running.

## Stopping and cleaning up

```bash
make stop      # stop the dependency containers
make cleanup   # stop + remove volumes and delete airborne_server/.env
```

## Troubleshooting

:::caution
`make cleanup` removes the database/Keycloak volumes **and** deletes `airborne_server/.env`. You will need to run `make setup` again (and re-run the init scripts via `make run`) afterwards.
:::

- **`MASTER_KEY must be set when USE_ENCRYPTED_SECRETS=true`** — you are in encrypted mode but the master key was never generated/encrypted into `.env`. Run `make run` (which executes `init-localstack.sh`), or switch to plaintext with `USE_ENCRYPTED_SECRETS=false`. The plaintext DEK lives in `airborne_server/.masterkey.local`; deleting it and `.env` together resets encryption state.
- **`AUTH_ADMIN_* must be set when AUTHN_PROVIDER=keycloak`** — the Keycloak init step did not populate the admin client values. Confirm Keycloak is healthy (`curl http://localhost:8180/realms/master`) and re-run `make keycloak-init`.
- **`SUPERPOSITION_ORG_ID` looks wrong / `get-org-id-from-superposition`** — the Superposition init step did not run or could not reach the service. Confirm `curl http://localhost:8080/health` returns `200`, then re-run `make superposition-init`.
- **Database connection refused** — the Postgres container may still be starting, or the port is taken. The app Postgres is published on `5433` (not the default `5432`); make sure nothing else is bound there and that `DB_PORT=5433`.
- **Port already in use** — the defaults are server `8081`, Superposition `8080`, Keycloak `8180`, Postgres `5433`, Keycloak DB `5434`, LocalStack `4566`, Redis `6379`, RedisInsight `5540`. Free the conflicting port or override it in `.env`.
- **Encryption scripts fail on Python** — they need a Python 3 with SSL and will install `cryptography` into `airborne_server/scripts/.python-tools`. Ensure `python3 -c 'import ssl'` works.

## Next

- [Configuration](/docs/server/configuration) — every environment variable explained.
- [Deploy on AWS ECS](/docs/server/deploy-ecs) and [Deploy on AWS EKS](/docs/server/deploy-eks) — taking the same dependency model to production.

## Isolated first-run sandbox

Run `make quickstart` from the repository root after installing Docker Compose, the pinned Rust toolchain, Node/npm, Python 3, curl and jq. The script creates a unique Compose project with loopback-only random ports and a private `.quickstart/` state directory. It retains Keycloak authentication, seeds `quickstart / first-app` and an exact `1.0.0` version cohort, starts the API/dashboard, and prints credentials and the next release steps. It skips Redis (REDIS_URL is unset), RedisInsight, analytics and docs. Superposition is pinned to SDK-compatible `0.113.0`. No auth bypass is installed.

Ctrl-C stops its own processes and removes only project-labelled containers, volumes and network. Logs and credentials remain locally for inspection. Run `python3 scripts/quickstart.py --smoke` to time startup and seed, then clean up automatically. The script binds its server to `127.0.0.1` and stops when disk space falls below 5 GB. This local plaintext setup is not production configuration.

Native SDK wiring, a native rebuild, bundling/uploading a package and validating the running app remain manual. Follow [React Native integration](/docs/guides/integrate-react-native). The seeded cohort targets only `app_version=1.0.0`; first releases require an explicit ramp and conclusion. Ten minutes is a walkthrough budget with prerequisites and build caches ready, not a cold-install promise.

## Persistent local data

Set `AIRBORNE_DATA_DIR` in `airborne_server/.env` to an absolute host directory.
Compose stores Superposition PostgreSQL under `superposition/` and LocalStack
S3/KMS snapshots under `localstack/` there (default: gitignored `.airborne-data/`).
A helper seeds a fresh Superposition cluster with its required permissions.
Existing deployments must import their stopped containers **before** Compose
recreates them; follow [backup and migration](/docs/server/superposition-backup/).

Container restart, recreation and `docker compose down` retain these host files.
Avoid `down -v`: Airborne Postgres and Keycloak still use named volumes, which that
command deletes. LocalStack saves periodically, so abrupt power loss can lose its
latest unsaved writes. Keep independent backups. The quickstart uses its own
`.quickstart/<project>/data` directory, isolated from your normal stack.

## Upgrading an existing local stack

The local setup now uses Superposition 0.113.0 (previously 0.89.0) and host bind mounts for LocalStack, replacing its earlier relative bind mount. Back up and migrate existing data using [the backup and persistence guide](./superposition-backup.md) before starting the new configuration; otherwise the new mount appears empty.

Quickstart retains logs, credentials and database files in `.quickstart/<project>`. On Linux, PostgreSQL data is owned by container UID 100 with mode 0700. After verifying that this quickstart's containers are stopped, an administrator must remove that specific project's directory with elevated permissions. Do not delete the shared data directory or other projects.

For a pre-persistence `localstack/localstack` source, export objects through S3
**before stopping it**. The old `/var/lib/localstack` bind mount is not a
`gresau/localstack-persist` snapshot, and a stopped ephemeral API may have lost
its objects. Use `aws --endpoint-url <old-endpoint> s3 sync s3://<bucket>
<export>/<bucket>/` for every bucket. Then stop the old services and set
`LOCALSTACK_S3_EXPORT=<absolute-export>` when running `seed-local-data.sh`.
The script imports objects into a disposable, network-isolated LocalStack with
no published ports, stops it to flush the new snapshot format, and promotes
both staged directories only after successful validation. It never copies an
old `/persisted-data` path that did not exist. If the old process was already
stopped without persistence or export, recover the objects from backup first.

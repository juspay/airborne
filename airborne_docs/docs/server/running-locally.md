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
- `init-localstack.sh` — creates the local KMS key (`alias/my-local-key`) and the S3 bucket, and (in encrypted mode) KMS-encrypts the master key and the sensitive variables into `.env`.
- `init-keycloak.sh` — reads the realm's client secrets from Keycloak and writes `OIDC_CLIENT_SECRET` / `AUTH_ADMIN_CLIENT_SECRET` (encrypted or plaintext per mode), along with the resolved issuer/token URLs.

The encryption mode used at run time is taken from `USE_ENCRYPTED_SECRETS` in `.env` (falling back to the `make` variable). To run without encryption:

```bash
make run USE_ENCRYPTED_SECRETS=false
```

## Migrations

Database schema is managed with [Diesel](https://diesel.rs/); migrations live in `airborne_server/migrations/` and `diesel.toml` points the generated schema at `src/utils/db/schema.rs`.

There are two ways migrations run:

- **Embedded, on boot** — the binary embeds the migrations (`embed_migrations!`) and runs any pending ones at startup when `MIGRATIONS_TO_RUN_ON_BOOT` includes `db` (the example `.env` sets `db,superposition`). See [boot-time migrations](/server/configuration#boot-time-migrations).
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

- [Configuration](/server/configuration) — every environment variable explained.
- [Deploy on AWS ECS](/server/deploy-ecs) and [Deploy on AWS EKS](/server/deploy-eks) — taking the same dependency model to production.

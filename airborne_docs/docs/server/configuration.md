---
title: Configuration
description: Exhaustive environment-variable reference for the Airborne server, grouped by concern, with required/default/purpose for each variable.
---

The Airborne server is configured entirely through environment variables, parsed at boot by `AppConfig::build` (in `airborne_server/src/config.rs`). This page is the authoritative reference. The example values come from `airborne_server/.env.example`; the parsing rules, defaults, and "required" markings come from `config.rs` itself.

A few rules apply across every variable:

- **Required** means the server **panics on boot** if the variable is missing (or, for secrets, fails to decrypt). "Required" below reflects what `config.rs` enforces; some variables are *conditionally* required — see the notes.
- An **empty** value is treated as **unset** for most string variables (`get_env`/`get_optional` ignore empty strings).
- Variables marked as **secret** are decrypted on boot when [`USE_ENCRYPTED_SECRETS=true`](#encryption); otherwise they are read as plaintext.
- Numeric and boolean variables fall back to their default if the value fails to parse (they do not error).

:::tip
For local development you rarely set these by hand. `make setup` seeds `airborne_server/.env` from `.env.example`, and the init scripts fill in the generated values (Keycloak secrets, Superposition org id, KMS-encrypted master key). See [Run locally](/docs/server/running-locally).
:::

## Server

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `8081` | TCP port the HTTP server binds on (`0.0.0.0:PORT`). |
| `SERVER_PATH_PREFIX` | No | `api` | Path prefix for the management API and the health route. The health check is `GET /{SERVER_PATH_PREFIX}/health`. |
| `KEEP_ALIVE` | No | `30` | Actix-web keep-alive timeout, in seconds. |
| `BACKLOG` | No | `1024` | Listen backlog (max pending connections). |
| `ACTIX_WORKERS` | No | `4` | Number of Actix worker threads. |
| `PUBLIC_ENDPOINT` | **Yes** | `http://localhost:3000` | Externally reachable base URL of the deployment. Used by the dashboard to reach the API and to build browser-facing URLs / redirects. |
| `RUST_LOG` | No | `debug,info,error,actix_web=info,error` | Standard Rust log filter directive. |
| `LOG_FORMAT` | No | _(empty)_ | Tracing output format. Empty selects the default human-readable format; set to a JSON-style value for structured logs. |

## Database

The server connects to PostgreSQL for application data **and** Casbin policies. There are two credential sets: a runtime user and a migration user (the migration user runs schema changes and is granted broader privileges).

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `DB_USER` | **Yes** | `postgres` | Runtime database user. |
| `DB_PASSWORD` | **Yes** (secret) | `postgres` | Runtime user password. Decrypted when `USE_ENCRYPTED_SECRETS=true`. |
| `DB_MIGRATION_USER` | **Yes** | `postgres` | User used to run Diesel migrations. |
| `DB_MIGRATION_PASSWORD` | **Yes** (secret) | `postgres` | Migration user password. Decrypted when `USE_ENCRYPTED_SECRETS=true`. |
| `DB_HOST` | **Yes** | `localhost` | Database host. |
| `DB_PORT` | **Yes** | `5433` | Database port (the local Postgres container maps `5433` → `5432`). |
| `DB_NAME` | **Yes** | `hyperotaserver` | Database name. |
| `DB_URL` | No | `postgres://postgres:postgres@localhost:5433/hyperotaserver` | Optional full connection URL. When set, used directly instead of assembling from the parts above. |
| `DB_MIGRATION_URL` | No | _(unset)_ | Optional full connection URL for the migration connection. |
| `DATABASE_POOL_SIZE` | No | `4` (`.env.example` sets `2`) | Connection-pool size. Note the code default is `4`; the example file overrides it to `2`. |

:::note
`DB_URL` / `DB_MIGRATION_URL` are optional overrides. If you provide them you can omit the corresponding discrete parts, but `DB_USER`, `DB_HOST`, `DB_PORT`, and `DB_NAME` are still read as required by `config.rs`, so keep them set. The `make db-migration` target separately reads `DATABASE_URL`/`DB_URL` from `.env` for the Diesel CLI.
:::

## Redis

Redis is an **optional** but recommended cache. It backs two things: the OIDC login **PKCE + nonce** hardening, and read caches for file, package, and workspace lookups.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string. When set, the server enables PKCE/nonce protection on the OIDC flow and caches hot reads. When unset, Redis is skipped entirely. |

How it is used:

- **Auth hardening.** When `REDIS_URL` is set, the login-initiation step generates a PKCE challenge and stores the code verifier and OIDC nonce in Redis (keyed by a hash of the OAuth `state`, 10-minute TTL, single-use). The callback consumes them to complete the PKCE exchange and verify the ID-token nonce.
- **Read caches.** File-entry lookups (3-day TTL), package reads and workspace-name lookups (1-week TTL) are cached and invalidated on the corresponding writes.

:::info[What happens without Redis]
If `REDIS_URL` is unset, OIDC login **still works**, but PKCE and nonce verification are silently skipped and no read caching happens. For production, deploy a Redis instance and set `REDIS_URL` to keep the auth flow hardened.
:::

:::caution[Malformed URL panics on boot]
If `REDIS_URL` is set but the value is invalid or the instance is unreachable at startup, the server **panics on boot**. Leave it unset to disable Redis; only set it to a working endpoint.
:::

:::note[Local development]
`make run` starts a bundled Redis via docker-compose. `REDIS_PORT` (default `6379`) is a **docker-compose-only** variable that maps the container port to the host; the server itself only reads `REDIS_URL`. `make redis` / `make redis-insight` start Redis and the RedisInsight UI on their own. See [Run locally](/docs/server/running-locally).
:::

## Authentication / OIDC

Authentication is OIDC-based. `AUTHN_PROVIDER` selects the flavour; the shared `OIDC_*` variables describe the issuer and client; the `AUTH_ADMIN_*` variables back provider-specific signup and user-management flows (mandatory for Keycloak).

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `AUTHN_PROVIDER` | No | `keycloak` | Authentication provider. One of `keycloak`, `oidc`, `okta`, `auth0`. Invalid values panic on boot. |
| `OIDC_ENABLED_IDPS` | No | `google` | Comma-separated IdP hints shown on the sign-in screen and mapped to provider icons (for example `google,github,microsoft`). Deduplicated and lowercased. |
| `OIDC_ISSUER_URL` | **Yes** | `http://localhost:8180/realms/hyperOTA` | OIDC issuer URL used to validate tokens. Required at boot (the server panics if unset). |
| `OIDC_EXTERNAL_ISSUER_URL` | No | `http://localhost:8180/realms/hyperOTA` | Issuer/base URL used for **browser** redirects. Defaults to `OIDC_ISSUER_URL`. A scheme is added if missing. |
| `OIDC_CLIENT_ID` | **Yes** | `hyperota` | OIDC client id. Required at boot. |
| `OIDC_CLIENT_SECRET` | **Yes** (secret) | `get-secret-from-keycloak` | OIDC client secret. Required at boot; decrypted when secrets are encrypted. |
| `OIDC_CLOCK_SKEW_SECS` | No | `60` | Allowed JWT clock skew (leeway) in seconds for `exp`/`nbf` validation. |
| `AUTH_ADMIN_CLIENT_ID` | Conditional | `hyperota` | Admin API client id. **Required when `AUTHN_PROVIDER=keycloak`** (otherwise optional). |
| `AUTH_ADMIN_CLIENT_SECRET` | Conditional (secret) | `get-admin-secret-from-keycloak` | Admin API client secret. **Required when `AUTHN_PROVIDER=keycloak`**; decrypted when secrets are encrypted. |
| `AUTH_ADMIN_TOKEN_URL` | Conditional | `http://localhost:8180/realms/hyperOTA/protocol/openid-connect/token` | Token endpoint for the admin client. **Required when `AUTHN_PROVIDER=keycloak`**. |
| `AUTH_ADMIN_ISSUER` | Conditional | `http://localhost:8180/realms/hyperOTA` | Keycloak realm URL (`https://<host>/[base-path]/realms/<realm>`). Parsed into host + realm. **Required when `AUTHN_PROVIDER=keycloak`**; an invalid format panics. |
| `AUTH_ADMIN_AUDIENCE` | No | _(empty)_ | Optional audience for admin token requests. |
| `AUTH_ADMIN_SCOPES` | No | _(empty)_ | Optional scopes for admin token requests. |

:::caution
When `AUTHN_PROVIDER=keycloak`, the server **panics on boot** if any of `AUTH_ADMIN_CLIENT_ID`, `AUTH_ADMIN_CLIENT_SECRET`, `AUTH_ADMIN_TOKEN_URL`, or a parseable `AUTH_ADMIN_ISSUER` is missing. For non-Keycloak providers these are optional. `AUTH_ADMIN_ISSUER` must be a realm URL containing `/realms/<realm>`.
:::

## Authorization / Casbin

Authorization uses Casbin, with policies persisted in Postgres. These variables control the authorization provider, super-admin bootstrapping, and policy reload cadence.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `AUTHZ_PROVIDER` | No | `casbin` | Authorization provider. Only `casbin` is supported; other values panic on boot. |
| `AUTHZ_BOOTSTRAP_SUPER_ADMINS` | No | _(empty)_ | Comma-separated list of identities granted super-admin on boot. Trimmed, lowercased, empties dropped. |
| `AUTHZ_CASBIN_AUTOLOAD_SECS` | No | `60` | Interval (seconds) at which Casbin reloads policies from the database. Only applied if it parses as a positive integer. |

## Superposition

Airborne uses Superposition as its configuration/feature-flag engine for dimensions and release targeting. The base URL and org id are required; the token variables are only needed when Superposition is run in authenticated mode.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `SUPERPOSITION_URL` | **Yes** | `http://localhost:8080` | Base URL of the Superposition service. |
| `SUPERPOSITION_ORG_ID` | **Yes** | `get-org-id-from-superposition` | Superposition organisation id. Populated by `init-superposition.sh` in dev. |
| `ENABLE_AUTHENTICATED_SUPERPOSITION` | No | `false` | When `true`, the Superposition SDK client sends auth tokens/cookies; this makes the three token variables below mandatory. |
| `SUPERPOSITION_TOKEN` | Conditional (secret) | _(unset)_ | Bearer token for Superposition. Used as the SDK bearer token (empty string if unset). |
| `SUPERPOSITION_USER_TOKEN` | Conditional (secret) | _(unset)_ | User cookie token. **Required when `ENABLE_AUTHENTICATED_SUPERPOSITION=true`** (panics if missing in that mode). |
| `SUPERPOSITION_ORG_TOKEN` | Conditional (secret) | _(unset)_ | Org cookie token. **Required when `ENABLE_AUTHENTICATED_SUPERPOSITION=true`** (panics if missing in that mode). |
| `SUPERPOSITION_CLEAR_UNUSED_PROVIDERS` | No | `false` | When `true`, a background task evicts idle per-workspace Superposition providers (see below). When `false`, providers live for the process lifetime. |
| `SUPERPOSITION_UNUSED_PROVIDER_TTL` | No | `43200` | Idle time, in seconds, after which an unused workspace provider is evicted. Only applied when eviction is enabled. Default is 12 hours. |
| `SUPERPOSITION_UNUSED_PROVIDER_CHECK_INTERVAL` | No | `1500` | How often, in seconds, the eviction sweep runs. Only applied when eviction is enabled. Default is 25 minutes. |
| `SUPERPOSITION_MIGRATION_STRATEGY` | No | `PATCH` | Strategy used when reconciling Superposition default configs during the `superposition` boot migration. |

Airborne serves release config by resolving each workspace's (organisation + application) configuration live against the Superposition API. To avoid re-creating the SDK client on every request, the server caches one provider per workspace in an in-memory registry. Enabling `SUPERPOSITION_CLEAR_UNUSED_PROVIDERS` starts a background sweep that drops providers that have not been accessed within `SUPERPOSITION_UNUSED_PROVIDER_TTL`, checked every `SUPERPOSITION_UNUSED_PROVIDER_CHECK_INTERVAL`. This bounds memory on servers hosting many rarely-served workspaces.

:::warning[Use the plural env-var name]
The server reads `SUPERPOSITION_CLEAR_UNUSED_PROVIDERS` (**plural**). The bundled `.env.example` currently writes it as `SUPERPOSITION_CLEAR_UNUSED_PROVIDER` (singular), which the server **ignores** — so a value set on the singular key has no effect. Always set the plural name.
:::

## AWS / S3 / KMS / LocalStack

The server talks to S3 (object storage) and KMS (secret decryption). AWS credentials and region are read by the AWS SDK from the standard environment variables. In local development LocalStack stands in for both S3 and KMS via `AWS_ENDPOINT_URL`.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `AWS_BUCKET` | **Yes** | `hyper-ota-bucket` | S3 bucket for files, packages, and resources. |
| `AWS_REGION` | **Yes** (SDK) | `us-east-1` | AWS region. Read by the AWS SDK credential/region chain. |
| `AWS_ENDPOINT_URL` | No | `http://localhost:4566` | Custom S3/KMS endpoint. When set, the S3 client switches to **path-style** addressing (needed for LocalStack). Leave unset in production to use real AWS. |
| `AWS_ACCESS_KEY_ID` | Conditional (SDK) | `test` | AWS access key. Read by the SDK. In production, prefer an IAM role over static keys. |
| `AWS_SECRET_ACCESS_KEY` | Conditional (SDK) | `test` | AWS secret key. Read by the SDK. Prefer IAM roles in production. |
| `AWS_SESSION_TOKEN` | No (SDK) | `test` | Optional session token for temporary credentials. |
| `CLOUDFRONT_DISTRIBUTION_ID` | No | `YOUR_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution id used for cache invalidations. Defaults to empty string if unset. |

:::note
`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` are not parsed by `config.rs` directly — they are consumed by the AWS SDK's default credential and region providers (`aws_config::from_env()`). On ECS/EKS you typically drop the static keys and grant the task/pod an IAM role instead; only `AWS_REGION` and `AWS_BUCKET` remain required, plus `AWS_ENDPOINT_URL` left unset.
:::

## Google Sheets (optional)

These are only used when `ORGANISATION_CREATION_DISABLED=true`, in which case the server reads an allow-list / org mapping from a Google Sheet and needs Google service-account credentials.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `GOOGLE_SPREADSHEET_ID` | Conditional | `1mFqLcqr1pErYe2jc_eLaXjOGlWIGwVgBjoAkVh_P5Rc` | Spreadsheet id read when org creation is disabled. **Required when `ORGANISATION_CREATION_DISABLED=true`** (panics otherwise). |
| `GCP_SERVICE_ACCOUNT_PATH` | Conditional | `/app/airborne-gcp.json` | Filesystem path to a Google service-account JSON. Used when org creation is disabled. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Conditional (secret) | _(unset)_ | Service-account JSON provided inline as an (encrypted) env var, as an alternative to `GCP_SERVICE_ACCOUNT_PATH`. Decrypted when secrets are encrypted. |

:::note
When `ORGANISATION_CREATION_DISABLED=true`, the server requires `GOOGLE_SPREADSHEET_ID` **and** a usable credential source — either `GCP_SERVICE_ACCOUNT_PATH` (a readable file) **or** `GOOGLE_SERVICE_ACCOUNT_KEY` (inline JSON). If neither yields valid credentials, boot fails.
:::

## Feature flags

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `ORGANISATION_CREATION_DISABLED` | No | `false` | When `true`, disables self-service org creation and switches to the Google Sheets allow-list model (see above). |
| `ENABLE_GOOGLE_SIGNIN` | No (legacy) | `false` | Legacy flag kept for backward compatibility. If `OIDC_ENABLED_IDPS` is unset and this is `true`, `google` is added to the enabled IdPs. Prefer `OIDC_ENABLED_IDPS`. |
| `USE_LEGACY_BUILD_PACKAGES` | No | `false` | When `true`, each Android build is published under **both** the new and the legacy Maven coordinates/paths, for backward compatibility with un-migrated Gradle clients. See the note below. |

:::note[Legacy Android build coordinates]
When `USE_LEGACY_BUILD_PACKAGES=true`, every Android build is uploaded to two coordinate sets (identical AAR bytes, with a layout-specific POM and `maven-metadata.xml` for each):

| | New (default) | Legacy |
| --- | --- | --- |
| groupId | `{org}` | `{org}.{app}` |
| artifactId | `{app}-airborne-assets` | `airborne-assets` |

Enable this only while you still have Android clients that resolve the old `{org}.{app}:airborne-assets` coordinates; new clients should declare `{org}:{app}-airborne-assets`. The AAR convenience endpoint (`GET /build/{org}/{app}/aar`) always serves the **new**-layout artifact regardless of this flag; the legacy coordinates are reachable only via the Maven/S3 repository paths.
:::

## Encryption

Airborne can store its secrets encrypted at rest in the environment using **envelope encryption**: a random Data Encryption Key (DEK, the "master key") encrypts each secret with AES-256-GCM, and the DEK itself is encrypted with **KMS**. At boot the server decrypts the master key via KMS, then uses it to decrypt each secret.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `USE_ENCRYPTED_SECRETS` | No | `true` | Master switch. When `true`, secret variables are treated as KMS-envelope-encrypted and decrypted on boot. When `false`, secrets are read as plaintext. |
| `MASTER_KEY` | Conditional (secret) | _(generated)_ | The **KMS-encrypted** Data Encryption Key. **Required when `USE_ENCRYPTED_SECRETS=true`** — the server errors with `MASTER_KEY must be set when USE_ENCRYPTED_SECRETS=true` if absent. Ignored when encryption is off. |

The secret variables that participate in encryption are:

- `DB_PASSWORD`
- `DB_MIGRATION_PASSWORD`
- `OIDC_CLIENT_SECRET`
- `AUTH_ADMIN_CLIENT_SECRET`
- `SUPERPOSITION_TOKEN`
- `SUPERPOSITION_USER_TOKEN`
- `SUPERPOSITION_ORG_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_KEY`

### The encrypt-envs flow

`airborne_server/scripts/encrypt-envs.sh` produces an encrypted `.env`:

1. Generates a random DEK and saves it locally to `.masterkey.local` (mode `600`, never commit it).
2. Encrypts the DEK with KMS (`aws kms encrypt`, key id defaults to `alias/airborne-secrets` for the standalone script; the LocalStack init script uses `alias/my-local-key`). The result is written as `MASTER_KEY` in `.env`.
3. Encrypts each secret listed above with AES-256-GCM under the DEK, storing each as a `{ "nonce": ..., "ciphertext": ... }` JSON blob.
4. Sets `USE_ENCRYPTED_SECRETS=true`.

Run it directly, or use the Makefile targets:

```bash
# Encrypt (KMS + AES-GCM)
cd airborne_server && ./scripts/encrypt-envs.sh

# Or plaintext mode (no encryption)
cd airborne_server && ./scripts/encrypt-envs.sh --plaintext
```

:::caution
The DEK in `.masterkey.local` is the plaintext key that can decrypt every secret. Keep it out of git and out of images. In production, prefer sourcing each secret from a secrets manager (AWS Secrets Manager / SSM) injected at runtime, or keep `USE_ENCRYPTED_SECRETS=true` with `MASTER_KEY` supplied by your secret store and a real KMS key granted to the task/pod role.
:::

To run **without** encryption locally, set `USE_ENCRYPTED_SECRETS=false` (secrets are then read verbatim):

```bash
make setup USE_ENCRYPTED_SECRETS=false
make run USE_ENCRYPTED_SECRETS=false
```

## Boot-time migrations

`MIGRATIONS_TO_RUN_ON_BOOT` is a comma-separated list controlling which migrations the server runs at startup. It is parsed case-insensitively and trimmed.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `MIGRATIONS_TO_RUN_ON_BOOT` | No | `db,superposition` (example) / `""` (code default) | Which boot migrations to run. Recognized tokens below. The compiled default is empty (no migrations); the example file sets `db,superposition`. |
| `SUPERPOSITION_MIGRATION_STRATEGY` | No | `PATCH` | Strategy applied by the `superposition` migration step (see [Superposition](#superposition)). |

Recognized tokens:

| Token | Effect |
| --- | --- |
| `db` | Runs pending **Diesel** database migrations (embedded in the binary) before serving. |
| `superposition` | Reconciles Superposition default configs using `SUPERPOSITION_MIGRATION_STRATEGY`. Boot **panics** if this migration fails. |
| `keycloaktocasbin` | Runs a one-time **Keycloak → Casbin** authorization import on boot (applies changes). This also triggers DB migrations first. |

:::note
The same Keycloak→Casbin import is also available as an explicit one-off command: run the server binary with `authz-import-keycloak --dry-run` (preview) or `authz-import-keycloak --apply` (apply). Use this instead of `keycloaktocasbin` in `MIGRATIONS_TO_RUN_ON_BOOT` when you want a controlled, out-of-band migration.
:::

## Metrics (optional)

The Airborne server can **push** its own Prometheus metrics to a [Victoria Metrics](https://victoriametrics.com/) instance. This is opt-in and independent of the [analytics server](#analytics-server) below.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `VICTORIA_METRICS_INSERT_URL` | No | _(empty)_ | Base URL of a Victoria Metrics instance. When non-empty, the server POSTs its metrics to `{url}/api/v1/import/prometheus` every 30 seconds. When empty, no metrics are pushed. |

Today the exported metrics are the Redis cache counters — `redis_cache_hits_total`, `redis_cache_misses_total`, and `redis_cache_fails_total` — labelled by instance, key prefix, organisation, application, and key-hierarchy level (useful for gauging cache effectiveness). There is no scrape endpoint; delivery is push-only.

## Webhooks (Kronos)

Airborne can deliver **signed HTTP webhooks** when things happen in an application (a release concluded, a package or cohort changed, …) or in an organisation (an application created, a member's role changed, …). Delivery is powered by [Kronos](https://github.com/juspay/kronos), a durable delayed-job engine, which runs **embedded in-process by default** — there is **nothing extra to deploy**. Set `KRONOS_URL` to use a separately-deployed Kronos instead. See the [Webhooks guide](/docs/guides/webhooks) for the user-facing flow.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `KRONOS_ENABLED` | No | `true` | Master switch for the shared Kronos client/worker. When `false`, no Kronos client/worker is started, so webhooks (its only consumer today) are inert. |
| `KRONOS_URL` | No | _(empty)_ | When set, use a **remote** (service-mode) Kronos over HTTP at this URL. When empty (default), Kronos runs **embedded** in-process against Airborne's own Postgres. |
| `KRONOS_API_KEY` | No | `dev-api-key` | Bearer token for a remote Kronos (service mode only). Participates in secret encryption. |
| `KRONOS_ORG_ID` | No | `airborne` | Kronos organization id (service mode). |
| `KRONOS_WORKSPACE` | No | `airborne_webhooks` | Kronos workspace. In embedded mode this is the Postgres schema Kronos creates its `kronos_*` tables in. |
| `KRONOS_ENCRYPTION_KEY` | No | 64 zeros | Embedded mode: key Kronos uses to encrypt the secrets it stores. |
| `KRONOS_DB_POOL_SIZE` | No | `2` | Embedded mode: size of Kronos's dedicated DB connection pool. |
| `KRONOS_TABLE_PREFIX` | No | `kronos_` | Embedded mode: prefix for Kronos's own tables. |
| `KRONOS_DATABASE_URL` | No | _(the migration DB URL)_ | Embedded mode: DB URL Kronos connects with. Defaults to the migration URL, which has the DDL rights needed to create its schema/tables. |
| `WEBHOOK_CALLBACK_BASE_URL` | No | `http://localhost:8081` | Base URL the Kronos worker calls back into Airborne on (`{base}/internal/webhooks/dispatch`). Must be reachable from the worker. |
| `WEBHOOK_INTERNAL_SECRET` | **Yes (prod)** | `airborne-internal-dev-secret` | Bearer secret guarding the internal dispatch callback. **Change in production.** |
| `WEBHOOK_OUTBOUND_TIMEOUT_SEC` | No | `10` | Per-delivery HTTP timeout when calling a customer URL. |
| `WEBHOOK_MAX_RETRIES` | No | `5` | Default (and cap) for delivery attempts per webhook. |
| `WEBHOOK_CONCLUDE_DELAY_SECONDS` | No | `60` | Delay before the `release.conclude` webhook fires, so downstream propagation completes first. |
| `WEBHOOK_DELIVERY_RETENTION_DAYS` | No | `7` | Days of delivery/attempt history to keep. Older rows are deleted by `POST /internal/webhooks/maintenance`, which a recurring Kronos job calls (a plain `DELETE`; attempts cascade). |
| `WEBHOOK_ALLOW_INSECURE` | No | `false` | **Dev only.** Allow `http`/loopback/private webhook URLs by disabling the SSRF host checks. Leave `false` in production. |

:::info[Embedded mode uses Airborne's Postgres]
In the default embedded mode, Kronos creates a small set of `kronos_*` tables in the `KRONOS_WORKSPACE` schema of Airborne's database and runs its worker as an in-process background task (an ~200 ms poll loop — no `pg_cron` required). The DB user must be able to create that schema and those tables; `KRONOS_DATABASE_URL` defaults to the migration user's URL for exactly this reason.
:::

## Analytics server

The analytics server (`airborne_analytics_server`) is an **optional, separate** service that ingests OTA events. It has its own configuration, parsed in `airborne_analytics_server/src/common/config.rs`. It supports two backends selected by `LOGGING_INFRASTRUCTURE`: **Kafka + ClickHouse** or **Victoria Metrics + Grafana**.

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `SERVER_PORT` | No | `6400` | Port the analytics HTTP server binds on. |
| `LOGGING_INFRASTRUCTURE` | No | `victoria-metrics` | Backend selector: `kafka-clickhouse` or `victoria-metrics`. Defaults to Victoria Metrics. |
| `KAFKA_BROKERS` | No | `localhost:9092` | Kafka bootstrap brokers. |
| `KAFKA_TOPIC` | No | `ota-events` | Kafka topic consumed for OTA events. |
| `KAFKA_CONSUMER_GROUP` | No | `ota-analytics-consumer` | Kafka consumer group id. |
| `KAFKA_SECURITY_PROTOCOL` | No | _(unset)_ | Optional Kafka security protocol (for example `SASL_SSL`). |
| `KAFKA_SASL_MECHANISMS` | No | _(unset)_ | Optional SASL mechanism (for example `PLAIN`). |
| `KAFKA_SASL_USERNAME` | No | _(unset)_ | Optional SASL username. |
| `KAFKA_SASL_PASSWORD` | No | _(unset)_ | Optional SASL password. |
| `CLICKHOUSE_URL` | No | `http://localhost:8123` | ClickHouse HTTP endpoint. |
| `CLICKHOUSE_DATABASE` | No | `analytics` | ClickHouse database name. |
| `CLICKHOUSE_USERNAME` | No | _(unset)_ | Optional ClickHouse username. |
| `CLICKHOUSE_PASSWORD` | No | _(unset)_ | Optional ClickHouse password. |
| `RUST_LOG` | No | `info,analytics=debug,rdkafka=info,clickhouse=debug` | Log filter for the analytics service. |

:::caution
The analytics `.env.example` also lists `DEFAULT_TENANT_ID`, and the stack-specific env files (`.env.victoria-metrics`, `.env.kafka-clickhouse`) use `KAFKA_BROKER_URL` and `VICTORIA_METRICS_URL`. These names are **not read** by `config.rs` in the current code — the parser reads `KAFKA_BROKERS` (not `KAFKA_BROKER_URL`) and has no Victoria-Metrics URL variable. Treat the table above (the variables `config.rs` actually parses) as authoritative, and the extra names as scaffolding for the Docker stacks.
:::

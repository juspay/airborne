---
title: Server Overview
description: What the Airborne server is, the control-plane responsibilities it owns, and the runtime dependencies it needs to run.
---

The Airborne server is the control plane for over-the-air (OTA) updates. It is a Rust service built on [Actix-web](https://actix.rs/) that manages organisations and applications, ingests files and packages, assembles releases, and serves the **release config** that the Airborne SDKs fetch at boot. The same binary also hosts the bundled dashboard UI used to operate all of this.

Functionally the server is two things at once: a **management API** (create orgs/apps, upload files, build packages, cut and target releases, administer access) and a **release delivery endpoint** that the SDKs hit to discover which package and resources to boot.

## What the server does

- **Organisations and applications** — the top-level tenancy model. Everything (files, packages, releases, access bindings) hangs off an organisation and an application within it.
- **Files** — individual assets uploaded to object storage, tracked in Postgres.
- **Packages** — versioned sets of files that make up a boot, distinguishing *important* files (block boot) from *lazy* files (downloaded in the background).
- **Releases** — a targeted, dimension-scoped pointer to a package plus resources. This is what the SDK resolves to a release config.
- **Dimensions** — key/value targeting attributes (for example app version or user segment) evaluated by the configuration engine so different cohorts can receive different releases.
- **RBAC** — authentication via an OIDC provider (Keycloak by default) and authorization via [Casbin](https://casbin.org/) policies stored in Postgres, with organisation- and application-scoped roles.
- **Release delivery** — public release routes the SDK calls to obtain the release config for an application/namespace.
- **Dashboard** — a single-page app served by the same binary; it talks to the API through the configured public endpoint.

## Runtime dependencies

The server does not run alone. The local `docker-compose.yml` provisions the full dependency set; in production you provision the managed equivalents. Each dependency and what it is for:

| Dependency | Purpose |
| --- | --- |
| **PostgreSQL** | Primary application data store — organisations, applications, files, packages, releases, build records, and the **Casbin authorization policies**. |
| **Keycloak** (+ its own Postgres) | The default OIDC identity provider. Issues the tokens the server validates, and exposes the admin API used by signup/user-management flows. Backed by a dedicated Keycloak Postgres instance. |
| **Superposition** | Juspay's feature-flag / configuration engine. Airborne stores dimensions and release targeting as Superposition contexts and resolves the release config through it. |
| **Redis** (optional) | Caches hot reads (files, packages, workspace lookups) and stores the OIDC login PKCE/nonce state so the sign-in flow is hardened. Optional but recommended in production; see [`REDIS_URL`](/docs/server/configuration#redis). |
| **Object storage (S3)** | Stores uploaded files, packages, and resources. In dev this is [LocalStack](https://www.localstack.cloud/); in production it is real Amazon S3. |
| **KMS** | Key-management service used for envelope encryption of secrets (see [`USE_ENCRYPTED_SECRETS`](/docs/server/configuration#encryption)). LocalStack in dev, real AWS KMS in production. |
| **Analytics server** (optional) | A separate service that ingests OTA events. It runs on one of two stacks: **Kafka + ClickHouse**, or **Victoria Metrics + Grafana**. See the [analytics variables](/docs/server/configuration#analytics-server). |

:::note
Keycloak is the **default** authentication provider, but `AUTHN_PROVIDER` also accepts `oidc`, `okta`, and `auth0`. The Keycloak admin variables (`AUTH_ADMIN_*`) are only mandatory when `AUTHN_PROVIDER=keycloak`. See [Authentication](/docs/server/configuration#authentication--oidc).
:::

## Ports

These are the default ports from the local development setup. Verify and adapt them for your own deployment.

| Service | Default port | Notes |
| --- | --- | --- |
| Airborne server | `8081` | `PORT`; binds `0.0.0.0`. |
| Dashboard (dev) | `3000` | Served separately in dev; `PUBLIC_ENDPOINT` points the API/CORS at it. |
| Superposition | `8080` | `SUPERPOSITION_URL`. |
| Keycloak | `8180` | OIDC issuer host (`8080` inside the container). |
| Keycloak metrics | `9000` | Keycloak health/metrics port. |
| PostgreSQL (app) | `5433` | `DB_PORT` (maps to `5432` in-container). |
| Keycloak Postgres | `5434` | Separate database for Keycloak. |
| Redis | `6379` | `REDIS_PORT` (docker-compose); the server connects via `REDIS_URL`. |
| RedisInsight | `5540` | Optional Redis UI (`REDIS_INSIGHT_PORT`). |
| LocalStack | `4566` | S3 + KMS endpoint (`AWS_ENDPOINT_URL`) in dev. |
| Analytics server | `6400` | `SERVER_PORT` of the analytics service. |
| Grafana | `4000` | Analytics (Victoria Metrics stack). |
| Victoria Metrics | `8428` | Analytics (Victoria Metrics stack). |
| Kafka | `9092` | Analytics (Kafka + ClickHouse stack). |
| ClickHouse | `8123` | HTTP interface (analytics, Kafka + ClickHouse stack). |
| Zookeeper | `2181` | Analytics (Kafka + ClickHouse stack). |

:::caution
Both the Airborne server (`8081`) and Superposition (`8080`) listen on distinct ports, but several dependencies share the port number `8080` *inside* their containers (Keycloak, Kafka UI). Always reason about the **published host port**, which is what the values above and the environment variables refer to.
:::

## Health endpoint

The server exposes a health check at:

```
GET /{SERVER_PATH_PREFIX}/health
```

`SERVER_PATH_PREFIX` defaults to `api`, so the default URL is `GET /api/health`. A healthy server responds `200 OK` with:

```json
{ "status": "ok" }
```

Use this path for load-balancer / orchestrator health checks (the ECS target group and the EKS readiness/liveness probes both point here).

## How the dashboard talks to the API

The bundled dashboard is a static SPA. It reaches the API through the address configured in `PUBLIC_ENDPOINT` — this is the externally reachable base URL of the deployment (for example `http://localhost:3000` in dev, or your public HTTPS endpoint in production). `PUBLIC_ENDPOINT` is also used to construct browser-facing URLs and must be set correctly for sign-in redirects and the dashboard's API calls to resolve.

## Where to go next

- [Configuration](/docs/server/configuration) — the complete environment-variable reference. Start here before any deployment.
- [Run locally](/docs/server/running-locally) — bring up the full stack with Docker and `make`.
- [Deploy on AWS ECS](/docs/server/deploy-ecs) and [Deploy on AWS EKS](/docs/server/deploy-eks) — conceptual production guides.

---
title: Deploy on AWS ECS
description: A conceptual reference for running the Airborne server on ECS (Fargate) — the dependencies to provision, image build, env wiring, migrations, and health checks.
---

This is a **conceptual reference guide**, not turnkey infrastructure-as-code. The repository ships only a `Dockerfile` and a local `docker-compose.yml` for development — there are no ECS task definitions, CloudFormation templates, or Terraform here. The guide maps the local docker-compose dependency model onto AWS managed services and explains the wiring; adapt it to your own ECS, networking, and IaC tooling.

If you have not read it yet, start with the [Configuration](/server/configuration) reference — every environment variable named here is documented there.

## Architecture

A typical ECS (Fargate) deployment looks like this:

```
                Internet
                   │
            ┌──────▼──────┐
            │     ALB     │  (HTTPS listener, target group health check → /api/health)
            └──────┬──────┘
                   │
         ┌─────────▼─────────┐
         │  ECS Service       │  (Fargate, desired count N)
         │  airborne_server   │  task role: S3 + KMS; secrets from SM/SSM
         │  tasks (port 8081) │
         └─────────┬─────────┘
                   │
   ┌───────────────┼───────────────┬───────────────┐
   │               │               │               │
┌──▼───┐      ┌────▼─────┐    ┌─────▼──────┐  ┌─────▼──────┐
│ RDS  │      │   S3     │    │  Keycloak  │  │Superposition│
│Postgres│    │ bucket + │    │ (ECS svc or│  │ (ECS svc or │
│        │    │   KMS    │    │  managed)  │  │  hosted)    │
└────────┘    └──────────┘    └────────────┘  └────────────┘
```

The Airborne server task is stateless; all state lives in RDS and S3. Keycloak and Superposition are themselves services with their own state — run each as its own ECS service (with its own RDS for Keycloak) or use externally hosted/managed equivalents.

## Map the dependencies to AWS

The local `docker-compose.yml` services translate to AWS as follows:

| docker-compose service | AWS equivalent | Notes |
| --- | --- | --- |
| `postgres` | **RDS for PostgreSQL** | Application data + Casbin policies. |
| `keycloak-db` | **RDS for PostgreSQL** (separate instance/db) | Backing store for Keycloak. |
| `keycloak` | **ECS service** (or managed OIDC) | Run the Keycloak image as its own service behind the ALB, or point `AUTHN_PROVIDER` at a managed provider. |
| `superposition` | **ECS service** | Run the Superposition image as its own service; the Airborne task reaches it over the VPC. |
| `redis` | **ElastiCache for Redis** (optional) | Backs read caches and the OIDC PKCE/nonce hardening. Optional but recommended; set `REDIS_URL` to its endpoint. Omit it and the server runs without caching or PKCE. |
| `localstack` (s3) | **Amazon S3** | A real S3 bucket. Leave `AWS_ENDPOINT_URL` unset so the SDK uses the real endpoint. |
| `localstack` (kms) | **AWS KMS** | A real KMS key, granted to the task role, for `USE_ENCRYPTED_SECRETS`. |

:::note
Provision the data dependencies (RDS, S3, KMS) and the supporting services (Keycloak, Superposition) **first**. The Airborne server fails to boot if Postgres, the OIDC issuer, Superposition, or the S3 bucket are unreachable.
:::

## Build and push the image

The production image is built from `airborne_server/Dockerfile` (a multi-stage build: a Node stage for the bundled frontend, a Rust stage for the server and the Diesel CLI, and a slim Ubuntu runtime). The `CMD` is the server binary, and the Diesel CLI is included in the image so you can run migrations from a task if you choose.

Build and push to **ECR** from the repository root:

```bash
# Authenticate Docker to ECR (replace region/account)
aws ecr get-login-password --region <region> \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Build using the server Dockerfile (note: build context is the repo root)
docker build -f airborne_server/Dockerfile -t airborne-server:latest .

# Tag and push
docker tag airborne-server:latest <account-id>.dkr.ecr.<region>.amazonaws.com/airborne-server:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/airborne-server:latest
```

:::caution
The `docker build` context is the **repository root** (the trailing `.`), not `airborne_server/`. The Dockerfile copies the whole workspace and builds from `airborne_server`. Building with the wrong context will fail.
:::

## Wire the environment variables

Set the variables from the [Configuration](/server/configuration) page on the task definition's container. Put **non-secret** values inline (`environment`) and pull **secrets** from AWS Secrets Manager or SSM Parameter Store (`secrets`).

The variables you must get right for a working ECS deployment:

- **Database** — `DB_USER`, `DB_PASSWORD`, `DB_MIGRATION_USER`, `DB_MIGRATION_PASSWORD`, `DB_HOST` (RDS endpoint), `DB_PORT`, `DB_NAME`. (Or provide `DB_URL`.)
- **Authentication / OIDC** — `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and (since the default `AUTHN_PROVIDER=keycloak`) `AUTH_ADMIN_CLIENT_ID`, `AUTH_ADMIN_CLIENT_SECRET`, `AUTH_ADMIN_TOKEN_URL`, `AUTH_ADMIN_ISSUER`. Set `OIDC_EXTERNAL_ISSUER_URL` if browser redirects use a different host than the in-VPC issuer.
- **Superposition** — `SUPERPOSITION_URL` (the Superposition service address) and `SUPERPOSITION_ORG_ID`. If you run Superposition authenticated, also set `ENABLE_AUTHENTICATED_SUPERPOSITION=true` and the three token secrets.
- **Redis (optional, recommended)** — `REDIS_URL` pointing at your ElastiCache endpoint (for example `redis://<primary-endpoint>:6379`). Enables PKCE/nonce hardening on sign-in and read caching. If you omit it, sign-in still works but without PKCE/nonce. Note: a set-but-unreachable `REDIS_URL` makes the server panic on boot, so provision Redis before setting it.
- **AWS / S3 / KMS** — `AWS_BUCKET`, `AWS_REGION`. **Leave `AWS_ENDPOINT_URL` unset** so the real AWS endpoints are used. Do **not** ship static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` — use the task role (below).
- **Public endpoint** — `PUBLIC_ENDPOINT` set to the externally reachable HTTPS URL (your ALB/domain). The dashboard and sign-in redirects depend on this.
- **Encryption** — either `USE_ENCRYPTED_SECRETS=true` with `MASTER_KEY` (the KMS-encrypted DEK) supplied as a secret and a KMS key granted to the task role, **or** `USE_ENCRYPTED_SECRETS=false` with the secret values injected as plaintext from Secrets Manager/SSM. See [Encryption](/server/configuration#encryption).
- **Migrations** — `MIGRATIONS_TO_RUN_ON_BOOT` (see below).

:::tip
With `USE_ENCRYPTED_SECRETS=false`, you can let Secrets Manager/SSM hold each secret in plaintext and inject it through the task definition's `secrets` block, skipping the envelope-encryption flow entirely. With `USE_ENCRYPTED_SECRETS=true`, you instead store the already-encrypted blobs and the encrypted `MASTER_KEY`, and grant the task role `kms:Decrypt` on the key. Either model works on ECS — pick one.
:::

## Run migrations

You have two options:

- **On boot (simplest)** — include `db` in `MIGRATIONS_TO_RUN_ON_BOOT` (for example `db,superposition`). The server runs pending Diesel migrations before it starts serving. Use the migration credentials (`DB_MIGRATION_USER`/`DB_MIGRATION_PASSWORD`) since the migration user needs broader privileges.
- **As a one-off task** — run a standalone ECS task from the same image to apply migrations before rolling out, then keep `db` out of the steady-state boot list. The image bundles the Diesel CLI for this; you can also use the binary's `authz-import-keycloak --apply` subcommand for the Keycloak→Casbin import as a one-off rather than the `keycloaktocasbin` boot token.

See [boot-time migrations](/server/configuration#boot-time-migrations) for the recognized tokens (`db`, `superposition`, `keycloaktocasbin`).

:::caution
If multiple tasks start simultaneously with `db` in the boot list, they may all attempt migrations at once. For predictable rollouts, prefer a single one-off migration task, or ensure your migrations are safe to run concurrently.
:::

## Health check

Point the ALB **target group health check** at:

```
GET /api/health
```

(That is `/{SERVER_PATH_PREFIX}/health`; `SERVER_PATH_PREFIX` defaults to `api`.) A healthy task returns `200` with `{ "status": "ok" }`. The container listens on `PORT` (default `8081`) — make the target group, the task's container port mapping, and the security groups all agree on that port.

## IAM

Use two roles on the task definition:

- **Task execution role** — lets ECS pull the image from ECR, write logs to CloudWatch, and read the secret values referenced in the task definition's `secrets` block (grant `secretsmanager:GetSecretValue` / `ssm:GetParameters`, and `kms:Decrypt` on the key that encrypts those secrets).
- **Task role** — the permissions the running server needs:
  - **S3** — read/write on the `AWS_BUCKET` (for example `s3:GetObject`, `s3:PutObject`, `s3:ListBucket`, `s3:DeleteObject`).
  - **KMS** — `kms:Decrypt` (and as needed `kms:Encrypt`, `kms:GenerateDataKey`) on the key used for `USE_ENCRYPTED_SECRETS`, when encryption is enabled.
  - **CloudFront** — `cloudfront:CreateInvalidation` if you set `CLOUDFRONT_DISTRIBUTION_ID` and rely on cache invalidations.

Because the task role provides credentials, you can omit `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` entirely — the AWS SDK picks up the role automatically.

## Checklist

- RDS (app) and RDS (Keycloak) provisioned and reachable from the service subnets.
- S3 bucket and KMS key created; task role granted access.
- Keycloak and Superposition running and reachable in-VPC; `OIDC_*`, `AUTH_ADMIN_*`, `SUPERPOSITION_*` set accordingly.
- (Optional) ElastiCache for Redis provisioned and reachable; `REDIS_URL` set to its endpoint.
- Image built with `-f airborne_server/Dockerfile` from the repo root and pushed to ECR.
- Task definition env wired per [Configuration](/server/configuration); secrets from Secrets Manager/SSM.
- Migration strategy chosen (`MIGRATIONS_TO_RUN_ON_BOOT` or a one-off task).
- ALB target group health check → `/api/health` on port `8081`.
- `PUBLIC_ENDPOINT` set to the public HTTPS URL.

For the Kubernetes equivalent, see [Deploy on AWS EKS](/server/deploy-eks).

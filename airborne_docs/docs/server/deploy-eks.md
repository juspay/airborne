---
title: Deploy on AWS EKS
description: A conceptual reference for running the Airborne server on EKS — the same dependency model on Kubernetes, with env wiring, IRSA, migrations, and probes.
---

This is a **conceptual reference guide**, not a complete set of manifests. The repository ships only a `Dockerfile` and a local `docker-compose.yml` for development — there are no Kubernetes manifests, Helm charts, or Kustomize bases here. The guide maps the local docker-compose dependency model onto Kubernetes primitives and shows a small illustrative env-wiring snippet; treat it as an outline to adapt to your cluster, not copy-paste YAML.

Read the [Configuration](/docs/server/configuration) reference first — every environment variable named here is documented there. The dependency mapping is the same as the [ECS guide](/docs/server/deploy-ecs); this page focuses on the Kubernetes-specific shape.

## Architecture on Kubernetes

The Airborne server becomes a stateless **Deployment** fronted by a **Service** and exposed through an **Ingress** (using the AWS Load Balancer Controller, which provisions an ALB). State lives outside the cluster in RDS and S3.

- **Deployment** — runs the `airborne_server` container (port `8081`), with N replicas.
- **Service** — a `ClusterIP` Service targeting the pods on port `8081`.
- **Ingress** — an ALB Ingress with an HTTPS listener; its target-group health check points at `/api/health`.
- **ConfigMap** — all **non-secret** environment variables.
- **Secret** (or External Secrets) — the **secret** environment variables.
- **ServiceAccount with IRSA** — grants the pods S3 + KMS access without static credentials.

The supporting services map the same way as on ECS: **RDS** for the application Postgres and (separately) for Keycloak, **S3** + **KMS** as real AWS services, and **Keycloak** and **Superposition** run either as their own in-cluster Deployments/Services or as externally hosted/managed services.

## Dependencies

| docker-compose service | Kubernetes / AWS equivalent |
| --- | --- |
| `postgres` | RDS for PostgreSQL (application data + Casbin policies). |
| `keycloak-db` | RDS for PostgreSQL (separate, for Keycloak). |
| `keycloak` | In-cluster Deployment/Service, or a managed OIDC provider. |
| `superposition` | In-cluster Deployment/Service. |
| `redis` | ElastiCache for Redis (optional; read caches + OIDC PKCE/nonce). Set `REDIS_URL`. |
| `localstack` (s3) | Amazon S3 (leave `AWS_ENDPOINT_URL` unset). |
| `localstack` (kms) | AWS KMS (granted via IRSA). |

:::note
Prefer RDS over running Postgres in the cluster for production state. If you do run Postgres/Keycloak/Superposition in-cluster, give them their own StatefulSets and persistent volumes; the Airborne Deployment itself should stay stateless.
:::

## Image

Build the image from `airborne_server/Dockerfile` with the **repository root** as the build context, and push it to ECR — the same build as the [ECS guide](/docs/server/deploy-ecs#build-and-push-the-image):

```bash
docker build -f airborne_server/Dockerfile -t airborne-server:latest .
```

Reference the resulting ECR image in the Deployment's container spec.

## Env wiring (illustrative)

Split configuration into a ConfigMap (non-secret) and a Secret (secret), and reference both from the container. The following is a **reduced, illustrative** outline — not a full manifest — to show the shape of the wiring:

```yaml
# ConfigMap: non-secret configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: airborne-config
data:
  PORT: "8081"
  PUBLIC_ENDPOINT: "https://airborne.example.com"
  AWS_REGION: "us-east-1"
  AWS_BUCKET: "airborne-bucket"
  # AWS_ENDPOINT_URL intentionally omitted -> use real AWS S3/KMS
  DB_HOST: "airborne-db.<id>.us-east-1.rds.amazonaws.com"
  DB_PORT: "5432"
  DB_NAME: "hyperotaserver"
  DB_USER: "airborne"
  DB_MIGRATION_USER: "airborne_migrator"
  OIDC_ISSUER_URL: "https://keycloak.example.com/realms/hyperOTA"
  OIDC_CLIENT_ID: "hyperota"
  AUTH_ADMIN_CLIENT_ID: "hyperota"
  AUTH_ADMIN_TOKEN_URL: "https://keycloak.example.com/realms/hyperOTA/protocol/openid-connect/token"
  AUTH_ADMIN_ISSUER: "https://keycloak.example.com/realms/hyperOTA"
  SUPERPOSITION_URL: "http://superposition.svc.cluster.local:8080"
  SUPERPOSITION_ORG_ID: "your-org-id"
  REDIS_URL: "redis://airborne-redis.<id>.cache.amazonaws.com:6379"   # optional
  MIGRATIONS_TO_RUN_ON_BOOT: "db,superposition"
  USE_ENCRYPTED_SECRETS: "false"
---
# Secret: secret configuration (use External Secrets / SealedSecrets in practice)
apiVersion: v1
kind: Secret
metadata:
  name: airborne-secrets
type: Opaque
stringData:
  DB_PASSWORD: "..."
  DB_MIGRATION_PASSWORD: "..."
  OIDC_CLIENT_SECRET: "..."
  AUTH_ADMIN_CLIENT_SECRET: "..."
  # If USE_ENCRYPTED_SECRETS=true, store the encrypted blobs here plus MASTER_KEY
---
# Deployment container snippet
spec:
  serviceAccountName: airborne   # bound to an IAM role via IRSA
  containers:
    - name: airborne-server
      image: <account-id>.dkr.ecr.us-east-1.amazonaws.com/airborne-server:latest
      ports:
        - containerPort: 8081
      envFrom:
        - configMapRef:
            name: airborne-config
        - secretRef:
            name: airborne-secrets
```

The variables you must get right are the same ones called out in the [ECS env-wiring section](/docs/server/deploy-ecs#wire-the-environment-variables): `DB_*`, `OIDC_*`, `AUTH_ADMIN_*` (since the default provider is Keycloak), `SUPERPOSITION_*`, `AWS_BUCKET`, `PUBLIC_ENDPOINT`, and the `USE_ENCRYPTED_SECRETS` / `MASTER_KEY` pair.

:::tip
In production, do not hand-write the Secret. Use **External Secrets Operator** to sync values from AWS Secrets Manager / SSM, or SealedSecrets. With `USE_ENCRYPTED_SECRETS=true`, the Secret holds the KMS-encrypted blobs and the encrypted `MASTER_KEY`, and the pod's IRSA role is granted `kms:Decrypt`. With `USE_ENCRYPTED_SECRETS=false`, the Secret holds plaintext values synced from your secret store.
:::

## IRSA for S3 / KMS

Use **IRSA** (IAM Roles for Service Accounts) so the pods assume an IAM role instead of carrying static keys:

1. Associate an OIDC provider with the cluster.
2. Create an IAM role with a trust policy for the cluster's OIDC provider, scoped to the `airborne` ServiceAccount.
3. Grant that role:
   - **S3** read/write on `AWS_BUCKET` (`s3:GetObject`, `s3:PutObject`, `s3:ListBucket`, `s3:DeleteObject`).
   - **KMS** `kms:Decrypt` (and `kms:Encrypt` / `kms:GenerateDataKey` as needed) on the key used for `USE_ENCRYPTED_SECRETS`, when encryption is on.
   - **CloudFront** `cloudfront:CreateInvalidation` if `CLOUDFRONT_DISTRIBUTION_ID` is set.
4. Annotate the ServiceAccount with the role ARN (`eks.amazonaws.com/role-arn`).

With IRSA in place, omit `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — the AWS SDK obtains credentials from the projected service-account token.

## Migrations

Two options, mirroring the [ECS guidance](/docs/server/deploy-ecs#run-migrations):

- **initContainer** — run a short-lived container from the same image to apply migrations before the main container starts. The image bundles the Diesel CLI, so an initContainer can run migrations (using `DB_MIGRATION_USER`/`DB_MIGRATION_PASSWORD`), or you can run a Kubernetes **Job** once per release. This avoids every replica racing to migrate on boot.
- **On boot** — include `db` in `MIGRATIONS_TO_RUN_ON_BOOT`. Simpler, but with multiple replicas they may all attempt migrations on startup.

Recognized tokens are `db`, `superposition`, and `keycloaktocasbin` — see [boot-time migrations](/docs/server/configuration#boot-time-migrations). The Keycloak→Casbin import can also be run out-of-band as a Job via the binary's `authz-import-keycloak --apply` subcommand.

## Probes

Point both probes at the health endpoint, `GET /{SERVER_PATH_PREFIX}/health` (default `/api/health`) on the container port:

```yaml
readinessProbe:
  httpGet:
    path: /api/health
    port: 8081
  initialDelaySeconds: 10
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /api/health
    port: 8081
  initialDelaySeconds: 20
  periodSeconds: 15
```

The ALB Ingress target-group health check should also resolve to `/api/health`. A healthy pod returns `200` with `{ "status": "ok" }`.

## Checklist

- RDS (app) and RDS (Keycloak) reachable from the cluster.
- S3 bucket and KMS key created; IRSA role granted access and bound to the ServiceAccount.
- Keycloak and Superposition reachable (in-cluster Services or external); `OIDC_*`, `AUTH_ADMIN_*`, `SUPERPOSITION_*` set.
- (Optional) ElastiCache for Redis reachable from the cluster; `REDIS_URL` set to its endpoint.
- Image built with `-f airborne_server/Dockerfile` from the repo root, pushed to ECR.
- ConfigMap (non-secret) and Secret/External Secrets (secret) wired into the Deployment.
- Migration approach chosen (initContainer/Job or boot-time `db`).
- Readiness/liveness probes and ALB health check → `/api/health` on `8081`.
- `PUBLIC_ENDPOINT` set to the public HTTPS URL exposed by the Ingress.

For the ECS/Fargate equivalent, see [Deploy on AWS ECS](/docs/server/deploy-ecs).

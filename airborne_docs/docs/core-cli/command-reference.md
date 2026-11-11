---
title: Command Reference
description: Complete reference for every Airborne Core CLI operation, grouped by resource, with usage examples and parameter tables.
---

This page documents every operation exposed by `airborne-core-cli`, grouped by resource. Each entry includes a usage example and a parameter table marking required and optional fields.

Conventions used throughout:

- Every authenticated operation requires `--token <access-token>` (obtained via `PostLogin` — see [Authentication](/docs/core-cli/authentication)). It is listed in each table for completeness.
- All operations support the three [input methods](/docs/core-cli/getting-started#input-methods): individual flags, a `@params.json` file, or a mix of the two.
- Run `airborne-core-cli configure --base-url <url>` once before using any operation.

:::note
When you invoke these same operations through the [React Native CLI](/docs/react-native-cli/command-reference) (`npx airborne-devkit <Command>`), omit `--token` — `airborne-devkit` injects your stored token automatically.
:::

## Organisation

### CreateOrganisation

Create a new organisation.

```bash
airborne-core-cli CreateOrganisation --name <name> --token <access-token>
```

| Parameter  | Type   | Required | Description                       |
| ---------- | ------ | -------- | --------------------------------- |
| `--name`   | string | Yes      | Name of the organisation.         |
| `--token`  | string | Yes      | Bearer token for authentication.  |

### ListOrganisations

List all organisations available to the authenticated user.

```bash
airborne-core-cli ListOrganisations --token <access-token>
```

| Parameter  | Type   | Required | Description                      |
| ---------- | ------ | -------- | -------------------------------- |
| `--token`  | string | Yes      | Bearer token for authentication. |

### RequestOrganisation

Submit a request to create an organisation (for review/approval).

```bash
airborne-core-cli RequestOrganisation \
  --organisation_name <organisation_name> \
  --name <name> \
  --email <email> \
  --phone <phone> \
  --app_store_link <app_store_link> \
  --play_store_link <play_store_link> \
  --token <access-token>
```

| Parameter             | Type   | Required | Description                   |
| --------------------- | ------ | -------- | ----------------------------- |
| `--organisation_name` | string | Yes      | Name of the organisation.     |
| `--name`              | string | Yes      | Name of the requester.        |
| `--email`             | string | Yes      | Email of the requester.       |
| `--phone`             | string | Yes      | Phone number of the requester. |
| `--app_store_link`    | string | Yes      | App Store link.               |
| `--play_store_link`   | string | Yes      | Play Store link.              |
| `--token`             | string | Yes      | Bearer token for authentication. |

## Application

### CreateApplication

Create a new application under an organisation.

```bash
airborne-core-cli CreateApplication \
  --application <application> \
  --organisation <organisation> \
  --token <access-token>
```

| Parameter        | Type   | Required | Description                      |
| ---------------- | ------ | -------- | -------------------------------- |
| `--application`  | string | Yes      | Name of the application.         |
| `--organisation` | string | Yes      | Name of the organisation.        |
| `--token`        | string | Yes      | Bearer token for authentication. |

### GetUser

Retrieve information about the currently authenticated user.

```bash
airborne-core-cli GetUser --token <access-token>
```

| Parameter  | Type   | Required | Description                      |
| ---------- | ------ | -------- | -------------------------------- |
| `--token`  | string | Yes      | Bearer token for authentication. |

## Dimension

### CreateDimension

Create a new dimension used for targeting releases.

```bash
airborne-core-cli CreateDimension \
  --dimension <dimension> \
  --description <description> \
  --dimension_type <standard|cohort> \
  --organisation <organisation> \
  --application <application> \
  --token <access-token> \
  [--depends_on <depends_on>]
```

| Parameter          | Type                   | Required | Description                                                          |
| ------------------ | ---------------------- | -------- | ------------------------------------------------------------------- |
| `--dimension`      | string                 | Yes      | Name of the dimension.                                              |
| `--description`    | string                 | Yes      | Description of the dimension.                                       |
| `--dimension_type` | `standard` or `cohort` | Yes      | Type of the dimension.                                              |
| `--organisation`   | string                 | Yes      | Name of the organisation.                                          |
| `--application`    | string                 | Yes      | Name of the application.                                           |
| `--depends_on`     | string                 | No       | Identifier of the parent dimension. Required for cohort dimensions; ignored for standard dimensions. |
| `--token`          | string                 | Yes      | Bearer token for authentication.                                   |

### UpdateDimension

Update the position of an existing dimension.

```bash
airborne-core-cli UpdateDimension \
  --dimension <dimension> \
  --change_reason <change_reason> \
  --position <position> \
  --organisation <organisation> \
  --application <application> \
  --token <access-token>
```

| Parameter         | Type    | Required | Description                      |
| ----------------- | ------- | -------- | -------------------------------- |
| `--dimension`     | string  | Yes      | Name of the dimension.           |
| `--change_reason` | string  | Yes      | Reason for the change.           |
| `--position`      | integer | Yes      | New position of the dimension.   |
| `--organisation`  | string  | Yes      | Name of the organisation.        |
| `--application`   | string  | Yes      | Name of the application.         |
| `--token`         | string  | Yes      | Bearer token for authentication. |

### DeleteDimension

Delete an existing dimension.

```bash
airborne-core-cli DeleteDimension \
  --dimension <dimension> \
  --organisation <organisation> \
  --application <application> \
  --token <access-token>
```

| Parameter        | Type   | Required | Description                      |
| ---------------- | ------ | -------- | -------------------------------- |
| `--dimension`    | string | Yes      | Name of the dimension.           |
| `--organisation` | string | Yes      | Name of the organisation.        |
| `--application`  | string | Yes      | Name of the application.         |
| `--token`        | string | Yes      | Bearer token for authentication. |

### ListDimensions

List all dimensions for an application.

```bash
airborne-core-cli ListDimensions \
  --organisation <organisation> \
  --application <application> \
  --token <access-token> \
  [--page <page>]
```

| Parameter        | Type    | Required | Description                      |
| ---------------- | ------- | -------- | -------------------------------- |
| `--organisation` | string  | Yes      | Name of the organisation.        |
| `--application`  | string  | Yes      | Name of the application.         |
| `--page`         | integer | No       | Page number for pagination.      |
| `--count`        | integer | No       | Number of results per page.      |
| `--token`        | string  | Yes      | Bearer token for authentication. |

## File

### CreateFile

Register a remote file record by URL (Airborne does not host the bytes; you do).

```bash
airborne-core-cli CreateFile \
  --file_path <file_path> \
  --url <url> \
  --organisation <organisation> \
  --application <application> \
  --token <access-token> \
  [--tag <tag>]
```

| Parameter        | Type     | Required | Description                                            |
| ---------------- | -------- | -------- | ------------------------------------------------------ |
| `--file_path`    | string   | Yes      | Path where the file will be stored on the SDK.         |
| `--url`          | string   | Yes      | URL from where the file can be downloaded.             |
| `--organisation` | string   | Yes      | Name of the organisation.                              |
| `--application`  | string   | Yes      | Name of the application.                               |
| `--tag`          | string   | No       | Tag to identify the file.                              |
| `--metadata`     | document | No       | Metadata as a stringified JSON value or a `@file.json` attachment. |
| `--token`        | string   | Yes      | Bearer token for authentication.                       |

### UploadFile

Upload a local file to Airborne storage.

```bash
airborne-core-cli UploadFile \
  --file <file-path> \
  --file_path <file_path> \
  --checksum <checksum> \
  --organisation <organisation> \
  --application <application> \
  --token <access-token> \
  [--tag <tag>]
```

| Parameter        | Type      | Required | Description                                                            |
| ---------------- | --------- | -------- | ---------------------------------------------------------------------- |
| `--file`         | file-path | Yes      | Local file path to upload (streamed).                                  |
| `--file_path`    | string    | Yes      | Destination path on the SDK.                                           |
| `--checksum`     | string    | Yes      | SHA-256 digest of the file, Base64-encoded, used by the server to verify integrity. |
| `--organisation` | string    | Yes      | Name of the organisation.                                              |
| `--application`  | string    | Yes      | Name of the application.                                               |
| `--tag`          | string    | No       | Tag to identify the file.                                              |
| `--token`        | string    | Yes      | Bearer token for authentication.                                       |

### ListFiles

List all files for an application.

```bash
airborne-core-cli ListFiles \
  --organisation <organisation> \
  --application <application> \
  --token <access-token> \
  [--page <page>]
```

| Parameter        | Type    | Required | Description                                          |
| ---------------- | ------- | -------- | ---------------------------------------------------- |
| `--organisation` | string  | Yes      | Name of the organisation.                            |
| `--application`  | string  | Yes      | Name of the application.                             |
| `--page`         | integer | No       | Page number for pagination.                          |
| `--per_page`     | integer | No       | Number of files per page.                            |
| `--search`       | string  | No       | Search query to filter files.                        |
| `--tags`         | string  | No       | Comma-separated tags to filter by (e.g. `prod,dev`). |
| `--token`        | string  | Yes      | Bearer token for authentication.                     |

### ListFileGroups

List grouped file records for an application.

```bash
airborne-core-cli ListFileGroups \
  --organisation <organisation> \
  --application <application> \
  --token <access-token> \
  [--page <page>]
```

| Parameter        | Type    | Required | Description                          |
| ---------------- | ------- | -------- | ------------------------------------ |
| `--organisation` | string  | Yes      | Name of the organisation.            |
| `--application`  | string  | Yes      | Name of the application.             |
| `--page`         | integer | No       | Page number for pagination.          |
| `--count`        | integer | No       | Number of groups per page.           |
| `--search`       | string  | No       | Search query to filter files by path. |
| `--tags`         | string  | No       | Comma-separated tags to filter by.   |
| `--token`        | string  | Yes      | Bearer token for authentication.     |

## Package

### CreatePackage

Create a deployable package from a set of files.

```bash
airborne-core-cli CreatePackage \
  --index <index> \
  --files <file-id-1> <file-id-2> \
  --organisation <organisation> \
  --application <application> \
  --token <access-token> \
  [--tag <tag>]
```

| Parameter        | Type     | Required | Description                                         |
| ---------------- | -------- | -------- | --------------------------------------------------- |
| `--index`        | string   | Yes      | Index file ID.                                      |
| `--files`        | string[] | Yes      | Space-separated file IDs to include in the package. |
| `--organisation` | string   | Yes      | Name of the organisation.                           |
| `--application`  | string   | Yes      | Name of the application.                            |
| `--tag`          | string   | No       | Tag for the package.                                |
| `--token`        | string   | Yes      | Bearer token for authentication.                    |

### ListPackages

List all packages for an application.

```bash
airborne-core-cli ListPackages \
  --organisation <organisation> \
  --application <application> \
  --token <access-token> \
  [--page <page>]
```

| Parameter        | Type    | Required | Description                            |
| ---------------- | ------- | -------- | -------------------------------------- |
| `--organisation` | string  | Yes      | Name of the organisation.              |
| `--application`  | string  | Yes      | Name of the application.               |
| `--page`         | integer | No       | Offset for pagination (default: 1).    |
| `--count`        | integer | No       | Limit for pagination (default: 50).    |
| `--search`       | string  | No       | Filter packages by index file path.    |
| `--all`          | boolean | No       | Fetch all packages without pagination. |
| `--token`        | string  | Yes      | Bearer token for authentication.       |

## Release

### CreateRelease

Create a new release from a config, with an optional package and dimensions. The `--config` parameter is a structured value; supply it most easily through a `@params.json` file. The server returns `409` if another release is already ongoing for the same dimensions; conclude or discard that release first. A `409` with `code: unresolved` means an earlier upstream write still needs authoritative recovery; follow the unresolved-write steps under [RollbackRelease](#rollbackrelease) before retrying.

```bash
airborne-core-cli CreateRelease @params.json --token <access-token>
```

Example `params.json`:

```json
{
  "config": {
    "release_config_timeout": 60000,
    "boot_timeout": 30000,
    "properties": "{\"tenant_info\":{}}"
  },
  "package_id": "version:42",
  "package": { "important": [], "lazy": [], "properties": {} },
  "dimensions": { "appVersion": "1.2.0" },
  "organisation": "myorg",
  "application": "myapp"
}
```

| Parameter                         | Type      | Required | Description                                               |
| --------------------------------- | --------- | -------- | --------------------------------------------------------- |
| `--config`                        | structure | Yes      | Release configuration (see nested fields below).         |
| `--config.release_config_timeout` | integer   | Yes      | Timeout for the release config, in milliseconds.              |
| `--config.boot_timeout`           | integer   | Yes      | Timeout for the package, in milliseconds.                     |
| `--config.properties`             | document  | Yes      | Config properties as stringified JSON.                   |
| `--organisation`                  | string    | Yes      | Name of the organisation.                                |
| `--application`                   | string    | Yes      | Name of the application.                                 |
| `--package_id`                    | string    | No       | Package ID for the release.                              |
| `--package.properties`            | document  | No       | Package properties as stringified JSON or an attachment. |
| `--package.important`             | string[]  | No       | Important files in the package.                          |
| `--package.lazy`                  | string[]  | No       | Lazy-loaded files in the package.                        |
| `--dimensions`                    | key-value | No       | Dimensions for targeting, as `key=value` pairs.          |
| `--resources`                     | string[]  | No       | Resources for the release.                               |
| `--token`                         | string    | Yes      | Bearer token for authentication.                         |

### GetRelease

Retrieve details for a specific release. The `experiment` object carries its `status` (`CREATED`, `INPROGRESS`, `CONCLUDED` or `DISCARDED`), `traffic_percentage`, and `experiment_variants`: the `control` id and the `experimentals` ids that [ConcludeRelease](#concluderelease) takes as `--chosen_variant`.

```bash
airborne-core-cli GetRelease \
  --releaseId <releaseId> \
  --organisation <organisation> \
  --application <application> \
  --token <access-token>
```

| Parameter        | Type   | Required | Description                      |
| ---------------- | ------ | -------- | -------------------------------- |
| `--releaseId`    | string | Yes      | ID of the release.               |
| `--organisation` | string | Yes      | Name of the organisation.        |
| `--application`  | string | Yes      | Name of the application.         |
| `--token`        | string | Yes      | Bearer token for authentication. |

### ListReleases

List all releases for an application.

```bash
airborne-core-cli ListReleases \
  --organisation <organisation> \
  --application <application> \
  --token <access-token> \
  [--dimension <dimension>]
```

| Parameter        | Type    | Required | Description                                              |
| ---------------- | ------- | -------- | ------------------------------------------------------- |
| `--organisation` | string  | Yes      | Name of the organisation.                               |
| `--application`  | string  | Yes      | Name of the application.                                |
| `--dimension`    | string  | No       | Filter by dimension, formatted as `key1=value1;key2=value2`. |
| `--page`         | integer | No       | Page number (default: 1).                               |
| `--count`        | integer | No       | Releases per page (default: 50).                        |
| `--all`          | boolean | No       | Fetch all releases without pagination.                  |
| `--status`       | string  | No       | Filter by status.                                       |
| `--token`        | string  | Yes      | Bearer token for authentication.                        |

### ServeRelease

Get the active release for an application (the release config the SDK consumes).

```bash
airborne-core-cli ServeRelease \
  --organisation <organisation> \
  --application <application> \
  --token <access-token>
```

| Parameter        | Type   | Required | Description                      |
| ---------------- | ------ | -------- | -------------------------------- |
| `--organisation` | string | Yes      | Name of the organisation.        |
| `--application`  | string | Yes      | Name of the application.         |
| `--token`        | string | Yes      | Bearer token for authentication. |

### ServeReleaseV2

Get the active release for an application using the v2 endpoint.

```bash
airborne-core-cli ServeReleaseV2 \
  --organisation <organisation> \
  --application <application> \
  --token <access-token>
```

| Parameter        | Type   | Required | Description                      |
| ---------------- | ------ | -------- | -------------------------------- |
| `--organisation` | string | Yes      | Name of the organisation.        |
| `--application`  | string | Yes      | Name of the application.         |
| `--token`        | string | Yes      | Bearer token for authentication. |

### Release lifecycle

A release moves through `CREATED` → `INPROGRESS` → `CONCLUDED` (or `DISCARDED`). [RampRelease](#ramprelease) starts it and sets its traffic, [ConcludeRelease](#concluderelease) makes the outcome permanent, [DiscardRelease](#discardrelease) cancels one that never started, and [RollbackRelease](#rollbackrelease) undoes a release from any state. Each command exits with a nonzero status when the server refuses it.

| Failure | Meaning |
| --- | --- |
| `403` `approval_required` | The application requires approvals and this change is not allowed directly. Raise a deployment request with [CreateControlCenterDeploymentRequest](#createcontrolcenterdeploymentrequest). A ramp that does not raise traffic (unless the release is marked rollback-sensitive) and every discard are allowed; every conclude needs approval. |
| `409` | The release is not in a state that allows the change (already concluded or discarded, still `CREATED` for a conclude, not `CREATED` for a discard). Read it with [GetRelease](#getrelease) and do not retry blindly. |
| `409` `unresolved` | An earlier upstream write for the application is unconfirmed, or this request's own outcome is unknown. Writes for the application are paused. Follow the unresolved-write steps under [RollbackRelease](#rollbackrelease). |
| `400` | A bad request, such as an unknown variant, a negative percentage, or a change reason containing the reserved text `Airborne operation`. |
| `404` | The release id does not exist in this application. |

### RampRelease

Set the share of traffic that receives a release. A new release serves no traffic until it is ramped; the first ramp moves it from `CREATED` to `INPROGRESS`. Ramp again to raise or lower the share, or ramp to `0` to pause it. The percentage is at most **50**: a release has one control and one experimental variant, and the experiment service refuses more.

Values outside 0–50 return `400` before the server acquires a write lock or calls Superposition, so they do not pause writes for the application. The core CLI sends the request; `airborne-devkit ramp-release` also rejects values outside this range locally.

```bash
airborne-core-cli RampRelease \
  --release_id <release_id> \
  --organisation <organisation> \
  --application <application> \
  --traffic_percentage 10 \
  --token <access-token>
```

Response:

```json
{
  "success": true,
  "message": "Release experiment ramped to 10% traffic",
  "experiment_id": "7522252134449025024",
  "traffic_percentage": 10
}
```

| Parameter             | Type    | Required | Description                                                                                  |
| --------------------- | ------- | -------- | -------------------------------------------------------------------------------------------- |
| `--release_id`        | string  | Yes      | ID of the release (returned by `CreateRelease`).                                              |
| `--organisation`      | string  | Yes      | Name of the organisation.                                                                     |
| `--application`       | string  | Yes      | Name of the application.                                                                      |
| `--traffic_percentage`| integer | Yes      | Percentage of traffic for the release, 0 to 50.                                               |
| `--change_reason`     | string  | No       | Reason recorded upstream. Limited to 197 bytes; must not contain `Airborne operation`.        |
| `--token`             | string  | Yes      | Bearer token for authentication.                                                              |

### ConcludeRelease

Make one variant of a ramped release permanent. Concluding on an experimental variant promotes the release for everyone; concluding on the control variant ends it and leaves the previous release live. The release must have been ramped first (`409`: "Ramp this release before concluding it"). When the application requires approvals, every conclude is refused with `403` `approval_required`.

`--chosen_variant` is an id generated by the experiment service (for example `7522252134449025024-experimental_1`), so read it from `experiment.experiment_variants` in the [GetRelease](#getrelease) response. An unknown variant returns `400` and lists the valid ones.

```bash
airborne-core-cli ConcludeRelease \
  --release_id <release_id> \
  --organisation <organisation> \
  --application <application> \
  --chosen_variant <variant_id> \
  --token <access-token>
```

Response:

```json
{
  "success": true,
  "message": "Release experiment concluded with variant 7522252134449025024-experimental_1",
  "experiment_id": "7522252134449025024",
  "chosen_variant": "7522252134449025024-experimental_1"
}
```

| Parameter          | Type   | Required | Description                                                                            |
| ------------------ | ------ | -------- | -------------------------------------------------------------------------------------- |
| `--release_id`     | string | Yes      | ID of the release.                                                                      |
| `--organisation`   | string | Yes      | Name of the organisation.                                                               |
| `--application`    | string | Yes      | Name of the application.                                                                |
| `--chosen_variant` | string | Yes      | Variant id to make permanent: the control id or an experimental id from `GetRelease`.   |
| `--change_reason`  | string | No       | Reason recorded upstream. Limited to 197 bytes; must not contain `Airborne operation`.  |
| `--token`          | string | Yes      | Bearer token for authentication.                                                        |

### DiscardRelease

Discard a release that has not been ramped, so it never serves traffic. Only a release in `CREATED` can be discarded; a ramped release has to be concluded on its control variant or rolled back, and a release that is already concluded or discarded returns `409`. Discarding never needs approval.

```bash
airborne-core-cli DiscardRelease \
  --release_id <release_id> \
  --organisation <organisation> \
  --application <application> \
  --token <access-token>
```

Response:

```json
{
  "success": true,
  "message": "Release experiment discarded",
  "experiment_id": "7522252134449025024"
}
```

| Parameter         | Type   | Required | Description                                                                            |
| ----------------- | ------ | -------- | -------------------------------------------------------------------------------------- |
| `--release_id`    | string | Yes      | ID of the release.                                                                      |
| `--organisation`  | string | Yes      | Name of the organisation.                                                               |
| `--application`   | string | Yes      | Name of the application.                                                                |
| `--change_reason` | string | No       | Reason recorded upstream. Limited to 197 bytes; must not contain `Airborne operation`.  |
| `--token`         | string | Yes      | Bearer token for authentication.                                                        |

### RollbackRelease

Roll back according to lifecycle state: `CREATED` is discarded, `INPROGRESS` is concluded on control, and a `CONCLUDED` release that is still latest live for its dimensions is re-released from its predecessor. Re-release reconciles historical config against currently registered keys. The `reconciled_keys` response lists newly registered keys kept at their current value and removed keys dropped from the restoration.

Before asking for confirmation, use `GetControlCenterRollbackPreview` (below). Show the resulting package and all kept/dropped keys, block when `blocked` is set, and explain that config reconciliation does not prove an older package works with changed config. The POST rechecks state under the app lock.

Errors and recovery:

- `403` `approval_required` means the application requires approvals for this rollback (a rollback of a concluded release, or of a rollback-sensitive release that has started). Raise a deployment request instead.
- `409` may mean stale/superseded state, an ongoing release, `replacement_changed`, or `unresolved`. Refresh ordinary state conflicts. For `replacement_changed`, inspect the replacement's variants, target, chosen variant, and Superposition change history; do not resume automatically.
- Durable rollback intent is saved before upstream writes. A definite partial failure returns `502` with `replacement_release_id`, `rollback_operation_id`, and `stage` (`create`, `ramp`, or `conclude`). Retry the same original release only after reviewing the replacement state.
- A completed retry returns the recorded success even if the first response was lost. It also reports nullable `current_live_release_id` and `later_release_id` to identify later unrelated activity without starting another rollback.
- Ramp percentage validation returns `400` before dispatch, and explicit upstream `400`/`422` ramp validation responses are recorded as rejected, so writes stay available. For other operations, only a failure known to have stopped before reaching Superposition (request construction or connect-phase errors) leaves writes available. Other failures can pause writes, including upstream `4xx` responses, because handlers can return errors after applying configuration effects; writes pause because Superposition contexts can overlap even when dimensions differ. `own_attempt: true` means this request may itself have changed upstream; absent/false means an earlier attempt is blocking it. Retry to reconcile automatically when current state or positive audit history proves acceptance. An absent marker, an unchanged experiment or elapsed time does not prove rejection.
- Use the dashboard's **Writes paused** panel and **Review recovery** flow as the normal recovery path. Only an organisation owner/admin or super admin can resolve. Airborne verifies current state/history and atomically writes the operation resolution and `operation_resolved` audit event with actor, finding, reason and evidence. `applied` needs positive evidence of the expected change in current state or audit history. `did_not_apply` needs the experiment and the app's workspace config (defaults, contexts, overrides) to match the snapshot saved before the write, and the operator must check server/proxy logs and confirm the request ended and cannot execute later; Airborne cannot verify termination independently. When config differs, the `409` names the changed keys and contexts: restore them, or finish the change and resolve as `applied`. Operations journaled before the snapshot existed cannot be resolved as `did_not_apply`. Direct SQL is an audited last resort when the route cannot establish a finding.
- Change reasons are preserved with an `Airborne operation <UUID>` marker. Superposition permits 255 bytes total; a user reason is limited to 197 bytes and longer values fail before dispatch. The text `Airborne operation` is reserved: a reason containing it is rejected with `400`. The marker is a correlation tag, not authenticated provenance; anyone who can write to Superposition directly can forge one, so restrict that access to trusted operators.
- Upstream calls have five-second and two-second connect deadlines. The 90-second operation budget is checked before dispatch and does not cancel an in-flight SDK call. Each server process caps writer sessions at 64. Session advisory locks require RDS Proxy session pinning or a direct/session-pinned PostgreSQL endpoint. PgBouncer transaction pooling is unsupported; a DSN with `pgbouncer=true` is refused.
- A burst of 50 simultaneous writes exhausted the local Superposition demo's connection pool. Test bursts against your own deployment; Airborne's writer cap does not establish Superposition's supported concurrency.
- Advanced schema assertions/patterns and keys with compute/validation functions are conservatively blocked before creation. A valid config may need operator review, and reconciliation does not prove compatibility of an older package with changed config.

The rollout requires a write drain: apply migrations `2026-10-31-000002_release_operations` and `2026-10-31-000003_operation_recovery`, disable/drain mutation routes on old instances and inspect ambiguous writes, deploy all new instances with writes still disabled, then re-enable and exercise preview, rollback, recovery and contention. Do not run old and new writers concurrently. Keep the operations table and unresolved records during binary rollback. See [Control Center server notes](/docs/server/control-center) for exact recovery steps.

```bash
airborne-core-cli RollbackRelease \\
  --release_id <release_id> \\
  --organisation <organisation> \\
  --application <application> \\
  --reason <reason> \\
  --token <access-token>
```

| Parameter        | Type   | Required | Description                                             |
| ---------------- | ------ | -------- | ------------------------------------------------------- |
| `--release_id`   | string | Yes      | ID of the release to roll back.                         |
| `--organisation` | string | Yes      | Name of the organisation.                               |
| `--application`  | string | Yes      | Name of the application.                                |
| `--reason`       | string | Yes      | Reason for the rollback. Whitespace-only values are rejected. |
| `--emergency`    | boolean | No       | Use the constrained emergency rollback path. Defaults to `false`; only a current checker can use it. |
| `--confirm_sensitive_risk` | boolean | No | Required as `true` when the source is marked rollback-sensitive. |
| `--token`        | string | Yes      | Bearer token for authentication.                        |

## Control Center

Operations behind the Control Center view: a cross-application release overview, application groups, and per-release audit timelines. See the [Control Center server notes](/docs/server/control-center) for background.

### ListControlCenterOperations

List unresolved upstream writes for an application. The route currently returns unresolved operations only; `--status unresolved` makes that filter explicit. Requires release-read access.

```bash
airborne-core-cli ListControlCenterOperations \\
  --organisation <organisation> \\
  --application <application> \\
  --status unresolved \\
  --token <access-token>
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `--organisation` | string | Yes | Organisation scope header. |
| `--application` | string | Yes | Application scope header. |
| `--status` | string | No | `unresolved`; this endpoint currently lists unresolved operations only. |
| `--token` | string | Yes | Bearer token for authentication. |

### ResolveControlCenterOperation

Ask Airborne to verify and resolve an unresolved operation. Only an organisation owner/admin or super admin may do this. The operation is re-read from Superposition, and the resolution plus its audit event are committed together.

```bash
airborne-core-cli ResolveControlCenterOperation \\
  --id <operation-uuid> \\
  --organisation <organisation> \\
  --application <application> \\
  --finding did_not_apply \\
  --reason <reason> \\
  --request_terminated true \\
  --token <access-token>
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `--id` | string | Yes | Unresolved operation UUID. |
| `--organisation` | string | Yes | Organisation scope header. |
| `--application` | string | Yes | Application scope header. |
| `--finding` | `applied` or `did_not_apply` | Yes | The finding Airborne will verify against upstream. |
| `--reason` | string | Yes | Non-blank reason recorded in the audit trail. |
| `--request_terminated` | boolean | No | Must be `true` for `did_not_apply`; operator attests the original request ended. |
| `--token` | string | Yes | Bearer token for authentication. |

For `did_not_apply`, check server/proxy logs and confirm the original request cannot execute later before resolving. The reason must not contain the reserved text `Airborne operation`. If workspace config changed since the write, the `409` names the keys and contexts to restore. See [Control Center recovery](/docs/server/control-center#durable-operations-and-errors).

### GetControlCenterOverview

Return the authenticated user's release overview across all organisations and applications they can access. No `--organisation` or `--application` is needed. The server answers within five seconds; an application whose lookup has not finished by then is returned with a non-null `error` and empty `live` and `active` lists. Each `active` entry includes `experimental_variant`, the exact variant ID needed to conclude it.

```bash
airborne-core-cli GetControlCenterOverview --token <access-token>
```

| Parameter  | Type   | Required | Description                      |
| ---------- | ------ | -------- | -------------------------------- |
| `--token`  | string | Yes      | Bearer token for authentication. |

### GetControlCenterRollbackPreview

Fetch the read-only rollback decision for a release. Requires release-read access and does not persist an operation, resolve an unresolved operation, or change upstream state. Use it before `RollbackRelease`; a non-null `blocked` object means do not confirm. The POST recalculates under lock.

```bash
airborne-core-cli GetControlCenterRollbackPreview \\
  --release_id <release_id> \\
  --organisation <organisation> \\
  --application <application> \\
  --token <access-token>
```

| Parameter        | Type   | Required | Description |
| ---------------- | ------ | -------- | ----------- |
| `--release_id`   | string | Yes      | Release to preview. |
| `--organisation` | string | Yes      | Name of the organisation. |
| `--application`  | string | Yes      | Name of the application. |
| `--token`        | string | Yes      | Bearer token for authentication. |

The response contains `action`, current/resulting package versions, `reconciled_keys`, and nullable `blocked`. Block codes are `superseded`, `ongoing`, `no_predecessor`, `incompatible`, and `unresolved`; diagnostics may include the current live release, operation, or replacement ID.

### ListControlCenterGroups

List the application groups of an organisation. Member applications are filtered to those the caller can read.

```bash
airborne-core-cli ListControlCenterGroups \
  --organisation <organisation> \
  --token <access-token>
```

| Parameter        | Type   | Required | Description                      |
| ---------------- | ------ | -------- | -------------------------------- |
| `--organisation` | string | Yes      | Name of the organisation.        |
| `--token`        | string | Yes      | Bearer token for authentication. |

### CreateControlCenterGroup

Create a group with a name and its full member list. Only organisation admins and owners can create groups. The `--members` parameter is a list of structures; supply it most easily through a `@params.json` file.

```bash
airborne-core-cli CreateControlCenterGroup @params.json --token <access-token>
```

Example `params.json`:

```json
{
  "organisation": "myorg",
  "name": "Storefront",
  "members": [
    { "application": "storefront-android", "platform": "android" },
    { "application": "storefront-ios", "platform": "ios" }
  ]
}
```

| Parameter        | Type               | Required | Description                                                                  |
| ---------------- | ------------------ | -------- | ---------------------------------------------------------------------------- |
| `--organisation` | string             | Yes      | Name of the organisation.                                                    |
| `--name`         | string             | Yes      | Name of the group.                                                           |
| `--members`      | structure[]        | Yes      | Members, each with `application` (string) and `platform` (`android`, `ios`, `web` or `other`). |
| `--token`        | string             | Yes      | Bearer token for authentication.                                             |

### UpdateControlCenterGroup

Replace a group's name and complete member list. Only organisation admins and owners can update groups.

```bash
airborne-core-cli UpdateControlCenterGroup @params.json --token <access-token>
```

| Parameter        | Type        | Required | Description                                              |
| ---------------- | ----------- | -------- | -------------------------------------------------------- |
| `--id`           | string      | Yes      | UUID of the group.                                       |
| `--organisation` | string      | Yes      | Name of the organisation.                                |
| `--name`         | string      | Yes      | New name of the group.                                   |
| `--members`      | structure[] | Yes      | Complete member list (same shape as `CreateControlCenterGroup`). |
| `--token`        | string      | Yes      | Bearer token for authentication.                         |

### DeleteControlCenterGroup

Delete a group by UUID. Only organisation admins and owners can delete groups.

```bash
airborne-core-cli DeleteControlCenterGroup \
  --id <id> \
  --organisation <organisation> \
  --token <access-token>
```

| Parameter        | Type   | Required | Description                      |
| ---------------- | ------ | -------- | -------------------------------- |
| `--id`           | string | Yes      | UUID of the group.               |
| `--organisation` | string | Yes      | Name of the organisation.        |
| `--token`        | string | Yes      | Bearer token for authentication. |

### GetControlCenterReleaseEvents

Return the ordered audit timeline for a release, plus the server-computed `outcome` (`active`, `live`, `superseded`, `concluded_on_control` or `discarded`). The timeline can also include synthetic created, concluded and discarded entries.

```bash
airborne-core-cli GetControlCenterReleaseEvents \
  --release_id <release_id> \
  --organisation <organisation> \
  --application <application> \
  --token <access-token>
```

| Parameter        | Type   | Required | Description                      |
| ---------------- | ------ | -------- | -------------------------------- |
| `--release_id`   | string | Yes      | ID of the release.               |
| `--organisation` | string | Yes      | Name of the organisation.        |
| `--application`  | string | Yes      | Name of the application.         |
| `--token`        | string | Yes      | Bearer token for authentication. |

### GetControlCenterApprovalPolicy

Read the current application policy. An absent policy returns disabled, empty rosters, a 24-hour request TTL, and emergency rollback enabled.

```bash
airborne-core-cli GetControlCenterApprovalPolicy \
  --organisation <organisation> \
  --application <application> \
  --token <access-token>
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `--organisation` | string | Yes | Organisation scope. |
| `--application` | string | Yes | Application scope. |
| `--token` | string | Yes | Bearer token. |

### UpdateControlCenterApprovalPolicy

Replace the complete policy. Only an actual organisation owner/admin may update it. Enabling requires at least two distinct subjects and a different eligible checker for every maker; the server also requires the deployment readiness fence.

```bash
airborne-core-cli UpdateControlCenterApprovalPolicy @policy.json --token <access-token>
```

Example `policy.json`:

```json
{
  "organisation": "myorg",
  "application": "storefront",
  "enabled": true,
  "makers": ["maker@example.com"],
  "checkers": ["checker@example.com"],
  "request_ttl_hours": 24,
  "emergency_rollback": true
}
```

`PUT` replaces all policy properties; omitted values take defaults. TTL is an integer from 1 through 720. Roster members must be enabled Keycloak users with application access and ordinary release permissions. Other AuthN providers fail closed for enablement until directory support is available.

### ListControlCenterDeploymentRequests

List newest matching requests. Status filtering happens before the 1,000-row cap. Omit `--application` to list readable requests across the organisation.

```bash
airborne-core-cli ListControlCenterDeploymentRequests \
  --organisation <organisation> \
  --status pending \
  --token <access-token>
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `--organisation` | string | Yes | Organisation scope. |
| `--application` | string | No | Optional application filter. |
| `--status` | enum | No | One of `pending`, `executing`, `executed`, `failed`, `rejected`, `cancelled`, `expired`, or `stale`. |
| `--token` | string | Yes | Bearer token. |

### CreateControlCenterDeploymentRequest

Raise an immutable deployment request. Supply the nested action payload in a JSON file. The server resolves and saves the snapshot, base state, requester, and SHA-256 payload hash; clients cannot set those fields. The maker reason must be nonblank and cannot contain reserved `Airborne operation` text.

```bash
airborne-core-cli CreateControlCenterDeploymentRequest @request.json --token <access-token>
```

Example `request.json`:

```json
{
  "organisation": "myorg",
  "application": "storefront",
  "action": "create",
  "payload": {
    "body": {
      "package_id": "version:3",
      "config": {"boot_timeout": 3000, "release_config_timeout": 3000, "properties": null},
      "package": {"properties": null, "important": [], "lazy": []},
      "resources": [],
      "dimensions": {},
      "rollback_sensitive": "security"
    }
  },
  "reason": "Deploy the reviewed security fix"
}
```

For actions other than `create`, include `release_id` and `body`. Actions are `create`, `update`, `ramp`, `conclude`, `discard`, `rollback`, and `set_rollback_sensitive`. Use immutable `@version:` selectors for package/file records; tag aliases and incomplete file records are rejected.

### GetControlCenterDeploymentRequest

Fetch one request by UUID. Both scope headers are required; lookup does not depend on the queue limit.

```bash
airborne-core-cli GetControlCenterDeploymentRequest \
  --id <request-uuid> --organisation <organisation> --application <application> --token <access-token>
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `--id` | string | Yes | Deployment request UUID. |
| `--organisation` | string | Yes | Organisation scope. |
| `--application` | string | Yes | Application scope. |
| `--token` | string | Yes | Bearer token. |

### ApproveControlCenterDeploymentRequest, RejectControlCenterDeploymentRequest, and CancelControlCenterDeploymentRequest

Approval executes immediately. The current checker must be eligible and different from the immutable requester; owners, admins and super admins receive no self-approval exception. A requester can cancel. A current checker may reject their own request, but rejection requires a reason. Approve and cancel accept an optional decision reason.

```bash
airborne-core-cli ApproveControlCenterDeploymentRequest \
  --id <request-uuid> --organisation <organisation> --application <application> --token <access-token>

airborne-core-cli RejectControlCenterDeploymentRequest \
  --id <request-uuid> --organisation <organisation> --application <application> \
  --reason "Not ready for release" --token <access-token>

airborne-core-cli CancelControlCenterDeploymentRequest \
  --id <request-uuid> --organisation <organisation> --application <application> --token <access-token>
```

Each command takes `--id`, `--organisation`, `--application`, and `--token` (all required). `--reason` is optional for approve/cancel and required for reject. The response is the updated request object.

### AcknowledgeEmergencyRollback

Independently acknowledge an emergency rollback. The path ID is the source release, not the replacement. Only a different current checker can acknowledge it.

```bash
airborne-core-cli AcknowledgeEmergencyRollback \
  --release_id <source-release-id> \
  --organisation <organisation> \
  --application <application> \
  --reason "Independent incident review" \
  --token <access-token>
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `--release_id` | string | Yes | Emergency source release ID, not the replacement. |
| `--organisation` | string | Yes | Organisation scope. |
| `--application` | string | Yes | Application scope. |
| `--reason` | string | Yes | Nonblank independent review explanation. |
| `--token` | string | Yes | Bearer token. |

One decision wins atomically. Expired or stale approval returns `409` and records its terminal status. Failed requests may be approved again only after recovery and fresh eligibility/state checks; interrupted `executing` requests are never blindly replayed. The API token represents its owner. See the full [maker-checker guide](/docs/guides/maker-checker) for emergency handling and trust limits.

## See also

- [Getting started](/docs/core-cli/getting-started)
- [Authentication](/docs/core-cli/authentication)
- [React Native CLI command reference](/docs/react-native-cli/command-reference)

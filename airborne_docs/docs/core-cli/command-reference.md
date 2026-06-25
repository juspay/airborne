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

Create a new release from a config, with an optional package and dimensions. The `--config` parameter is a structured value; supply it most easily through a `@params.json` file.

```bash
airborne-core-cli CreateRelease @params.json --token <access-token>
```

Example `params.json`:

```json
{
  "config": {
    "release_config_timeout": 60,
    "boot_timeout": 30,
    "properties": "{\"tenant_info\":{}}"
  },
  "package_id": "42",
  "dimensions": { "appVersion": "1.2.0" },
  "organisation": "myorg",
  "application": "myapp"
}
```

| Parameter                         | Type      | Required | Description                                               |
| --------------------------------- | --------- | -------- | --------------------------------------------------------- |
| `--config`                        | structure | Yes      | Release configuration (see nested fields below).         |
| `--config.release_config_timeout` | integer   | Yes      | Timeout for the release config, in seconds.              |
| `--config.boot_timeout`           | integer   | Yes      | Timeout for the package, in seconds.                     |
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

Retrieve details for a specific release.

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

## See also

- [Getting started](/docs/core-cli/getting-started)
- [Authentication](/docs/core-cli/authentication)
- [React Native CLI command reference](/docs/react-native-cli/command-reference)

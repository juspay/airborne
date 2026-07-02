---
title: Conventions & errors
description: Common request headers, the standard error response format and codes, pagination, and the role/permission model used across the Airborne API.
---

This page covers the cross-cutting behaviour shared by every endpoint: headers, errors, pagination, and authorization.

## Example requests

Every endpoint page includes a copyable `curl` example. They all reference the same shell variables, so export these once and the examples will run as-is:

```bash
export AIRBORNE_URL="https://your-host"   # base URL, includes scheme, no trailing slash
export TOKEN="<access-token>"             # bearer token — see Authentication
export ORG="<organisation>"              # organisation name (x-organisation)
export APP="<application>"               # application name (x-application)
```

Get a `TOKEN` via the [Authentication](/api-reference/authentication) flow (for automation, a [personal access token](/api-reference/authentication#2-personal-access-tokens-recommended-for-automation) is easiest). Endpoints that also take a path identifier (a release id, token client id, dimension name, …) use an extra uppercase variable in the example, e.g. `$RELEASE_ID` — set it to the value you're operating on.

:::note[Base URL prefix]
`AIRBORNE_URL` is the host only. The `/api` prefix (or the root `/release`, `/build` prefixes) is part of each path in the examples. `/api` is the default `SERVER_PATH_PREFIX`; if your deployment overrides it, adjust accordingly.
:::

## Request headers

| Header | Applies to | Description |
| --- | --- | --- |
| `Authorization` | All authenticated endpoints | `Bearer <access_token>` — see [Authentication](/api-reference/authentication). |
| `x-organisation` | Organisation- and application-scoped endpoints | Organisation name that scopes the call. |
| `x-application` | Application-scoped endpoints | Application name that scopes the call. |
| `x-dimension` | Targeted reads (releases, properties, serving) | Dimension filter as `key1=value1;key2=value2`. |
| `x-checksum` | `POST /api/file/upload` | Base64-encoded SHA-256 of the uploaded bytes. |
| `x-force` | `GET /build/...` | Force a rebuild of the requested artifact. |
| `Content-Length` | Raw file upload | Length of the streamed body. |

Every response includes an `x-request-id` header (generated if you don't send one) for log correlation.

## Error responses

All errors share one JSON shape:

```json
{ "code": "AB_005", "message": "human-readable description" }
```

| HTTP status | `code` | Meaning |
| --- | --- | --- |
| 400 | `AB_005` | Bad request — invalid input, or a malformed body/path/query (extractor failures also return 400). |
| 401 | `AB_004` | Unauthorized — missing/invalid token, or no accessible identity. |
| 403 | `AB_006` | Forbidden — authenticated but missing the required permission. |
| 404 | `AB_001` | Not found. |
| 409 | `AB_007` | Conflict. |
| 500 | `AB_003` | Internal server error. |

## Pagination

List endpoints accept the same query parameters and return a consistent envelope. Parameter names differ slightly by endpoint (older endpoints use `per_page`; most use `count`) — the per-endpoint tables are authoritative.

| Query param | Type | Description |
| --- | --- | --- |
| `page` | integer | 1-based page number. |
| `count` / `per_page` | integer | Page size. Some endpoints cap this (e.g. files at 200). |
| `all` | boolean | Where supported, fetch everything and ignore paging. |
| `search` | string | Free-text filter (endpoint-specific target). |

Paginated responses wrap the rows with totals — typically `data` (or a named array such as `files`), `total_items`, and `total_pages`.

## Authorization: roles and permissions

Beyond authentication, most endpoints enforce a **permission** through [Casbin](https://casbin.org/). Access is granted by the caller's **role** at the organisation and/or application scope.

### Roles

Roles are hierarchical — a higher role inherits every permission of the roles below it:

| Role | Level | Inherits |
| --- | --- | --- |
| `super_admin` | 5 | Everything (platform-wide; **bypasses** all checks). |
| `owner` | 4 | `admin` and below. |
| `admin` | 3 | `write` and below. |
| `write` | 2 | `read`. |
| `read` | 1 | — |

### How a check is evaluated

Each protected endpoint declares a permission as `resource.action` (for example `release.create`, `file.read`, `organisation_user.update`). When you call it:

1. A **super-admin** is always allowed.
2. Otherwise the server checks your role at the **application** scope (when both `x-organisation` and `x-application` are present), then falls back to the **organisation** scope.
3. If neither scope grants the `resource.action`, the call fails with `403` (`AB_006`).

The endpoint tables in this reference list the roles that satisfy each permission, as **org roles** / **app roles**. An empty app-role list means the permission is only grantable at the organisation scope.

:::tip[Discover permissions programmatically]
Two introspection endpoints let a client (like the dashboard) tailor its UI to the caller's rights: `GET /api/authz/catalog` lists the permissions in scope, and `POST /api/authz/me/enforce-batch` checks up to 200 `resource.action` pairs at once.
:::

### Custom roles

Beyond the built-in roles, organisations and applications can define **custom roles** as a named set of permissions. Manage them from the [Dashboard](/dashboard/users-and-roles).

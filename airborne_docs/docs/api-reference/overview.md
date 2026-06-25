---
title: API Reference
description: The Airborne server HTTP API — base URL, tenancy model, content types, and how this reference is generated from the Smithy/OpenAPI contract.
---

The Airborne server exposes an HTTP API for managing organisations and applications, uploading files, building packages, and cutting and targeting releases — plus the **public** endpoints the SDK calls to fetch its release config.

This reference documents the operations that make up the **Airborne API contract** — the same operations the [Core CLI](/docs/core-cli/getting-started) and the generated SDK are built from. Each operation page below has an interactive request panel with copyable `curl` (and other language) snippets. For the command-line equivalents see the [Core CLI command reference](/docs/core-cli/command-reference); for the UI, see the [Dashboard](/docs/dashboard/overview) docs.

## Base URL and path prefix

The management API is served under a configurable prefix:

```
https://<your-host>/<SERVER_PATH_PREFIX>
```

`SERVER_PATH_PREFIX` defaults to `api`, so the default base is `https://<your-host>/api`. Every management path in this reference is written with that `/api` prefix.

Some route groups are mounted at the **root**, outside the API prefix:

| Prefix | Purpose | Auth |
| --- | --- | --- |
| `/release` | Public [release-serving / OTA](/docs/api-reference/endpoints/serve-release) endpoints the SDK calls. | Public |
| `/build` | Public build-artifact endpoints (version, zip, aar). Not part of the API contract; see the [Server](/docs/server/overview) docs. | Public |
| `/docs` | This documentation site. | Public |

`PUBLIC_ENDPOINT` (required at boot) is the externally reachable base URL of the deployment; it is used to build the OIDC redirect URI and internal release URLs. See [Configuration](/docs/server/configuration#server).

## How this reference is generated

These pages are generated from a single source of truth: the **Smithy** model in `smithy/models/*.smithy`. The build converts the model to an OpenAPI specification with [`smithy-openapi`](https://smithy.io/2.0/guides/model-translations/converting-to-openapi.html), and [`docusaurus-plugin-openapi-docs`](https://github.com/PaloAltoNetworks/docusaurus-openapi-docs) renders that spec into the interactive pages you see here.

The MDX pages regenerate from the committed spec automatically on every `npm run build` and `npm start` (via `prebuild`/`prestart` hooks), so `make docs-build` and the Docker/CI build always reflect the current spec. You only need to refresh the spec itself when the **model** changes:

```bash
cd smithy && smithy build                       # model → openapi/Airborne.openapi.json
cp output/source/openapi/Airborne.openapi.json ../airborne_docs/openapi/airborne.openapi.json
# the next build/start regenerates the MDX; to do it now: npm run gen-api-docs:fresh
```

:::note[Scope of this reference]
This reference covers the operations in the Smithy API contract — the stable, SDK/CLI-backed surface. The server also exposes additional **dashboard/admin** endpoints (member and role management, cohorts, config and property schemas, and the release lifecycle) that are driven through the [Dashboard](/docs/dashboard/overview) and are not part of this contract.
:::

## Tenancy: organisation and application context

Airborne is multi-tenant. Almost every management call operates within an **organisation** and, for most resources, an **application**. That context is passed as **request headers**, not path parameters:

| Header | When | Value |
| --- | --- | --- |
| `x-organisation` | Organisation- and application-scoped calls | Organisation name |
| `x-application` | Application-scoped calls | Application name |

:::tip[Headers, not path params]
The management endpoints do **not** take `{org}`/`{app}` path segments — e.g. it is `POST /api/releases` with `x-organisation` + `x-application` headers, not `POST /api/organisations/{org}/applications/{app}/releases`. The only paths that carry org/app in the URL are the public serving routes (`/release/{organisation}/{application}` and `/build/{organisation}/{application}`).
:::

## Content types

- Requests and responses are `application/json` unless noted.
- File upload (`POST /api/file/upload`) streams a **raw body** and takes an `x-checksum` header; this is called out on the operation's page.
- A `x-request-id` header is echoed on every response (and accepted on requests) for correlation.

## Where to start

- [Authentication](/docs/api-reference/authentication) — obtain a bearer token (OIDC login or a personal access token) and set the `Authorization` header.
- [Conventions & errors](/docs/api-reference/conventions) — common headers, the error response format and codes, pagination, and the permission/role model.
- Then browse the operations in the sidebar, grouped by resource (Authentication, Users, Organisations, Applications, Files, Packages, Releases, Release serving, Dimensions).

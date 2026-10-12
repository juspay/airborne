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

## Client-side resolution: `extended=true`

By default the release-serving endpoints ([`/release/{organisation}/{application}`](/docs/api-reference/endpoints/serve-release) and [`/release/v2/...`](/docs/api-reference/endpoints/serve-release-v-2)) resolve targeting **on the server**: you send your dimensions in `x-dimension` and a `toss`, and you get back one already-resolved release config.

Adding `extended=true` keeps that resolved response exactly as-is and attaches an extra `unresolved_properties` object containing the **unresolved** Superposition bundle for the application's workspace — the same targeting data the server just resolved against, narrowed to the `config.properties` key space:

| Field | What it is |
| --- | --- |
| `config` | The workspace config: `contexts`, `overrides`, `default_configs` and `dimensions`. |
| `config_version` | Version identifier of the workspace config. |
| `config_last_modified` | When the workspace config last changed (RFC 3339). |
| `experiments` | Active experiments — needed to resolve a ramped release. |
| `experiment_groups` | Experiment groups, used to bucket a caller by its targeting key. |
| `experiments_last_modified` | When the experiment config last changed (RFC 3339). |

**Detect it by the response `version`.** A response carrying `unresolved_properties` reports `version: "3"`; without it the response is `version: "2"` and is byte-for-byte the shape it has always been. The version tracks what is actually in the payload, not what was asked for — so if `extended=true` was requested but the bundle could not be fetched (see below), you get `"2"` and can take your existing v2 path unchanged.

**Scope.** Only `config.properties` is returned. Every other config key — `config.version`, `config.boot_timeout`, `config.release_config_timeout`, `package.*`, `resources` — is filtered out of `default_configs` and out of every override map and experiment variant, and any context whose overrides do not touch `config.properties` is dropped along with them. So this bundle resolves **properties** and nothing else; the package to boot from still comes from the server-resolved part of the response.

The bundle is **not** filtered by the caller's dimensions: the point of it is that the holder can resolve any dimension combination locally, which a pre-filtered response could not support.

Cohorts need no separate call, and `dimensions` is deliberately left unfiltered so they keep working. A cohort is a *derived* dimension — its entry in `config.dimensions` carries `dimension_type: {"LOCAL_COHORT": "<dimension it depends on>"}` plus a `schema` holding the ordered `enum` of cohort names and the JsonLogic `definitions` for each. Cohort membership is therefore derivable from this payload alone: evaluate the definitions in `enum` order and take the first match, falling back to `otherwise`.

:::warning[The bundle contains your targeting rules]
`extended=true` returns targeting data that server-side resolution never exposes. In particular, a cohort built as a **group** embeds its member list (for example the user IDs in it) directly in the dimension's `definitions`, so every caller that requests the bundle receives the whole list. Narrowing to `config.properties` does **not** change this — `dimensions` is passed through in full. Treat the endpoint accordingly, and prefer server-side resolution where the targeting rules themselves are sensitive.
:::

:::note[Degrades rather than fails]
The resolved release config is what an SDK boots from, so it is never held hostage to the bundle fetch. If `extended=true` is requested but the bundle cannot be fetched, the server logs the failure and returns the response **without** the `unresolved_properties` field rather than failing the request — so callers must treat it as optional and fall back to the resolved config.
:::

### Caching and freshness

The bundle is cached in Redis per (organisation, application), so a request with `extended=true` normally costs no extra Superposition round-trip. The cache is **refreshed in place** whenever anything that can change the bundle changes: a release is **created, updated, ramped, concluded or discarded**, the **`config.properties` schema** is updated, or a **dimension or cohort** is created, updated or deleted (cohort definitions travel in `dimensions`).

Refresh is write-through — the server re-reads from Superposition and overwrites the cached entry as part of the mutation — so the first device to ask after a release is cut does not pay the round-trip. If either the re-read or the write-back fails, the entry is dropped instead, so a failed refresh can never leave the pre-mutation bundle in place. A 7-day TTL backstops anything that bypasses those paths — for example editing the workspace in Superposition directly. If Redis is unavailable the server falls back to Superposition rather than dropping the bundle.

Note that the serve-release response itself is CDN-cacheable for a day (`s-maxage=86400`), so a cache drop on the server does not by itself reach callers already being served from a CDN edge.

## Where to start

- [Authentication](/docs/api-reference/authentication) — obtain a bearer token (OIDC login or a personal access token) and set the `Authorization` header.
- [Conventions & errors](/docs/api-reference/conventions) — common headers, the error response format and codes, pagination, and the permission/role model.
- Then browse the operations in the sidebar, grouped by resource (Authentication, Users, Organisations, Applications, Files, Packages, Releases, Release serving, Dimensions).

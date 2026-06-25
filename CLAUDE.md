# Airborne — repository guide for Claude

Airborne delivers over-the-air (OTA) updates to React Native, Android, and iOS apps. Major components:

| Area | Path | What it is |
| --- | --- | --- |
| React Native SDK / plugin | `airborne-react-native/` | JS package + native bridge that boots the app from an OTA bundle |
| Android / iOS SDKs | `airborne_sdk_android/`, `airborne_sdk_iOS/` | Native OTA SDKs |
| React Native CLI | `airborne_cli/` (`airborne-devkit`) | High-level RN workflow CLI |
| Core CLI | `airborne-core-cli/` | Low-level CLI generated from the Smithy API model (`smithy/`) |
| Server | `airborne_server/` | Rust/Actix control plane; serves the release config |
| Dashboard | `airborne_dashboard/` | Next.js web UI |
| **Documentation** | **`airborne_docs/`** | **Standalone Docusaurus site: docs at `/docs`, blog at `/blog` (deployed separately from the server)** |

## ⚠️ Keep the documentation in sync

`airborne_docs/` is the single source of truth for user-facing documentation. **Whenever you change something that the docs describe, update `airborne_docs/` in the same change.** This is not optional — out-of-date docs are treated as a bug.

Update the docs when you:

- Add/change/remove a **CLI command or flag** (`airborne_cli/`, `airborne-core-cli/`, `smithy/`) → update `airborne_docs/docs/react-native-cli/**` and `airborne_docs/docs/core-cli/**`.
- Add/change a **Smithy operation or its docs** (`smithy/models/**`) → the **API Reference** is generated from the model, so regenerate it (see `airborne_docs/CLAUDE.md` → "API Reference"): `cd smithy && smithy build`, copy the OpenAPI spec into `airborne_docs/openapi/`, then `npm run clean-api-docs && npm run gen-api-docs`. Do not hand-edit `airborne_docs/docs/api-reference/endpoints/**`.
- Change the **SDK public API, callbacks, or events, or the native integration steps** (`airborne-react-native/`, `airborne_sdk_android/`, `airborne_sdk_iOS/`) → update `airborne_docs/docs/react-native-sdk/**`.
- Add/change a **server environment variable, dependency, route, or deployment step** (`airborne_server/`) → update `airborne_docs/docs/server/**` (the env-var tables in `configuration.md` must stay exhaustive).
- Add/change a **dashboard feature or flow** (`airborne_dashboard/`) → update `airborne_docs/docs/dashboard/**` and refresh the relevant screenshots (see `airborne_docs/CLAUDE.md`).
- Change **release/targeting/cohort behavior** → update the guides in `airborne_docs/docs/guides/**`.

Before finishing such a change, run `cd airborne_docs && npm run build` — it fails on broken links, so it catches docs that reference renamed/removed pages.

See **`airborne_docs/CLAUDE.md`** for the docs-site authoring conventions (admonition syntax, screenshots, links).

## How the docs are served

The docs are a **standalone static site**, deployed independently of `airborne_server` (the server no longer serves them — there is no `docs.rs`, no `docs_dist`, and the `Dockerfile` does not build the docs).

- **Public URLs:** served via **CloudFront** at `https://airborne.juspay.in` — docs at `/docs`, blog at `/blog`, and `/` (the app frontend, not the docs). The `/docs` home is the landing page (`airborne_docs/src/pages/docs/index.tsx`). `airborne_docs/src/pages/index.tsx` is a `<meta http-equiv="refresh">` page that sends the site's own root to `/docs/` (reached in local dev / direct-origin access, not via CloudFront where the app owns `/`).
- **Config:** `baseUrl: "/"`, `url: "https://airborne.juspay.in"`, `trailingSlash: true` (all constant — no env overrides). The site is built at the **root**; the `/airborne` GitHub-Pages prefix is *not* in the build.
- **Hosting + routing:** the build is published to **GitHub Pages** (`juspay.github.io/airborne`) by `.github/workflows/docs.yaml` (`actions/deploy-pages`, on pushes to `main` under `airborne_docs/**`; repo setting Settings → Pages → Source: **GitHub Actions**). **CloudFront** fronts `airborne.juspay.in`: an origin `juspay.github.io` with **Origin Path `/airborne`** (which maps the root paths to the project-pages storage prefix), and cache behaviors routing `/docs/*`, `/blog/*`, `/assets/*`, `/img/*` (+ `/sitemap.xml`, `/llms*.txt`) to it; the default behavior goes to the app frontend. `trailingSlash: true` keeps GitHub Pages from 301-redirecting directory paths (which would leak `/airborne`). **Cache invalidation is done manually** (not in the workflow).
- **Local:** `make docs` runs the Docusaurus dev server at `http://localhost:3001/` (docs at `/docs`); also started as part of `make run`.

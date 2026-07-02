# airborne_docs — authoring guide for Claude

This is the Airborne documentation site (Docusaurus 3 + TypeScript). It is served at **`airborne.juspay.in/docs/`** and built into the server image. Keep it in sync with the code (see the repo-root `CLAUDE.md`).

## Commands

- `npm start` — dev server with hot reload (use `-- --port 3001` locally; `make docs` does this).
- `npm run build` — production build. **`onBrokenLinks` is `throw`**, so a broken internal link fails the build. Always run this before finishing a docs change.
- `npm run serve` — preview the built site.

## Structure

- Content: `docs/` — organised as **Guides** and **Documentation** (React Native SDK, React Native CLI, Core CLI, Server, Dashboard). The sidebar is defined explicitly in `sidebars.ts`; **add new pages there** (order comes from that file, not from `sidebar_position`).
- Each doc's id is its path under `docs/` without extension (e.g. `docs/server/configuration.md` → id `server/configuration`).
- Landing page: `src/pages/index.tsx`. Theme: `src/css/custom.css` (matches the dashboard — violet `#605ACA`, Space Grotesk).

## Critical conventions (these caused real bugs — follow them)

1. **Base path / links.** `baseUrl` is `/docs/` and the docs plugin uses `routeBasePath: "/"`. Write internal links **without** the `/docs` prefix — Docusaurus adds `baseUrl` automatically. Correct: `[Releases](/dashboard/releases)`. Wrong: `/docs/dashboard/releases`.

2. **Admonition titles use brackets.** Docusaurus 3 dropped the space-separated title syntax. Use `:::info[My title]` on its own line, body on the next line, closing `:::`. **`:::info My title` silently renders as plain text** (it does not error the build). Types: `note`, `tip`, `info`, `warning`, `danger`, `caution`.
   ```
   :::tip[Namespace must match]
   The value must match the release URL segment.
   :::
   ```

3. **Everything is MDX.** Docusaurus parses `.md` as MDX too. A raw `<` or `{` in prose breaks the build — wrap placeholders in backticks: `` `<organisation>` ``, `` `{ ... }` ``. Use `.mdx` for any page that embeds a component.

4. **Screenshots are theme-aware.** Embed with the `<Screenshot>` component (file must be `.mdx`):
   ```mdx
   import Screenshot from '@site/src/components/Screenshot';

   <Screenshot name="releases-list" caption="The Releases list." width="720px" />
   ```
   Images live at `static/img/screenshots/{light,dark}/<name>.png` — **you must provide both a light and a dark capture** (same filename in each folder). Light shows in light mode, dark in dark mode.

## How to (re)capture dashboard screenshots

Drive the live dashboard with Playwright (the dashboard runs on `localhost:3000`). Gotchas learned the hard way:

- Keycloak access tokens expire ~5 min; the dashboard hard-redirects to `/login` on a 401. Re-login with the account email as the username.
- Seed demo data fast via authenticated in-page `fetch` using the bearer token in `localStorage['airborne:token']`, with `x-organisation` / `x-application` headers (mirror `airborne_dashboard`'s `apiFetch` calls). This avoids mid-flow logouts.
- Toggle theme instantly (no reload) by adding/removing the `dark` class on `<html>`; hide the Next.js dev overlay with injected CSS `nextjs-portal{display:none!important}`.
- For callouts, draw a fixed-position overlay box (brand `#605ACA`) using element coordinates from a `browser_snapshot({boxes:true})`, then screenshot.
- Capture both a `light/` and a `dark/` variant for every screenshot.

## API Reference (generated from Smithy → OpenAPI)

The **API Reference** section is generated, not hand-written. Pipeline: `smithy/models/*.smithy` → (`smithy build`, `openapi` plugin in `smithy/smithy-build.json`) → `openapi/airborne.openapi.json` → (`docusaurus-plugin-openapi-docs`) → `docs/api-reference/endpoints/*.api.mdx`.

- **Only these three pages are hand-written:** `docs/api-reference/overview.md`, `authentication.md`, `conventions.md`. Everything under `docs/api-reference/endpoints/` is generated — **do not edit those by hand**; change the Smithy model instead.
- **The MDX regenerates automatically on build.** `npm run build` (→ `make docs-build`, Docker, CI) and `npm start` run a `prebuild`/`prestart` hook (`gen-api-docs:fresh` = `clean-api-docs && gen-api-docs`) that rebuilds `docs/api-reference/endpoints/**` from the **committed** `openapi/airborne.openapi.json`. No Java needed at build time — only the committed spec.
- **To change an endpoint's docs:** edit the `///` doc comments (or `@documentation`/`@tags`) in `smithy/models/*.smithy`, then refresh the spec (the MDX regenerates on the next build/start):
  ```bash
  cd smithy && smithy build
  cp output/source/openapi/Airborne.openapi.json ../airborne_docs/openapi/airborne.openapi.json
  # then `npm run build`/`npm start` regenerates the MDX; or run `npm run gen-api-docs:fresh` now
  ```
- **Grouping** in the sidebar comes from each operation's `@tags(["Category"])`. The generated `docs/api-reference/endpoints/sidebar.ts` is imported into `sidebars.ts` and spread under the "API Reference" category after the three conceptual pages.
- **Config:** `docusaurus.config.ts` registers `docusaurus-plugin-openapi-docs` (+ `docusaurus-theme-openapi-docs`, `docusaurus-plugin-sass`) and sets `docItemComponent: "@theme/ApiItem"`.
- **What is committed:** only `openapi/airborne.openapi.json` (the spec). The generated `docs/api-reference/endpoints/**` (`.api.mdx`, JSON sidecars, `sidebar.ts`) is **git-ignored** and regenerated on every build/start via the `prebuild`/`prestart`/`pretypecheck` hooks. This keeps generated artifacts out of git and avoids secret-scanner false positives on the embedded base64 `api:` blob (it trips `generic-api-key`; it is compressed OpenAPI metadata, not a secret). Repo-root `.gitleaks.toml` and `.gitguardian.yaml` also allowlist that path.
- **Scope:** only the ~22 operations bound to the `Airborne` service in `smithy/models/main.smithy` are documented. Dashboard/admin-only endpoints (RBAC, cohorts, config/property schemas, release lifecycle) are intentionally not in the contract and not in this reference.

## Diagrams, sitemap, and llms.txt

- **Mermaid diagrams:** enabled via `@docusaurus/theme-mermaid` (`markdown.mermaid: true`, theme registered, `themeConfig.mermaid` light/dark). Author diagrams as ```` ```mermaid ```` fenced blocks in any `.md`/`.mdx` (they render client-side, so `npm run build` won't catch mermaid *syntax* errors — sanity-check in `npm start`).
- **Sitemap:** `@docusaurus/plugin-sitemap` ships **inside `preset-classic`** — it is configured in the preset's `sitemap` key, not added to `plugins` (adding it again throws "used 2 times"). Produces `build/sitemap.xml`.
- **llms.txt:** `docusaurus-plugin-llms-txt` produces `build/llms.txt` + `build/llms-full.txt` (needs `fullLLMsTxt: true`). Caveat (plugin v0.1.3): it derives each page's section from a **navbar item with a matching `sidebarId`**, so the navbar's "Documentation" entry is a `type: "docSidebar"` item (`sidebarId: "docsSidebar"`) — without it the plugin logs a non-fatal `[ERROR]` per doc. It also emits URLs with a single-slash (`https:/…`) join bug; harmless, upstream issue.

## When you change the docs URL/base path

The base path is wired in three places that must agree: `docusaurus.config.ts` (`baseUrl`), `airborne_server/src/docs.rs` (the `/docs` scope + `./docs_dist`), and `airborne_server/Dockerfile` (build `airborne_docs/` → copy `build/` to `/app/docs_dist`).

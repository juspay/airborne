# airborne_docs — authoring guide for Claude

This is the Airborne documentation site (Docusaurus 3 + TypeScript). It is a **standalone static site** hosted on GitHub Pages and served via **CloudFront** at **`https://airborne.juspay.in`** (docs at **`/docs`**, blog at **`/blog`**), independently of `airborne_server`. It is built at the **root**: `baseUrl: "/"`, `url: "https://airborne.juspay.in"`, `trailingSlash: true`. The GitHub-Pages `/airborne` prefix is hidden by CloudFront's Origin Path, so it never appears in a URL. Keep it in sync with the code (see the repo-root `CLAUDE.md`).

## Commands

- `npm start` — dev server with hot reload (use `-- --port 3001` locally; `make docs` does this).
- `npm run build` — production build. **`onBrokenLinks` is `throw`**, so a broken internal link fails the build. Always run this before finishing a docs change.
- `npm run serve` — preview the built site.

## Structure

- Content: `docs/` — organised as **Guides** and **Documentation** (React Native SDK, React Native CLI, Core CLI, Server, Dashboard). The sidebar is defined explicitly in `sidebars.ts`; **add new pages there** (order comes from that file, not from `sidebar_position`).
- Each doc's id is its path under `docs/` without extension (e.g. `docs/server/configuration.md` → id `server/configuration`).
- Landing page: `src/pages/docs/index.tsx` — a custom page that renders at **`/docs`** (the docs home). There is no doc with `slug: /`, so this page owns `/docs` without colliding with the docs plugin. The bare site root `/` is `src/pages/index.tsx`, a `<meta http-equiv="refresh">` page that redirects to `/docs` (done as a page, not the client-redirects plugin, so it works in `docusaurus start` too — the plugin only runs at build time; and via meta-refresh so it works without JS). Theme: `src/css/custom.css` (matches the dashboard — violet `#605ACA`, Space Grotesk).

## Blog

The classic-preset blog is enabled (`blog: {...}` in `docusaurus.config.ts`, `routeBasePath: "blog"`). With `baseUrl: "/"`, the blog is served at **`/blog`**, a sibling of the docs at `/docs`.

- Posts live in `blog/` (e.g. `blog/2026-07-06-welcome/index.md`). Authors are defined in `blog/authors.yml`, tags in `blog/tags.yml` — reference them by key from a post's front matter so `onInlineAuthors`/`onInlineTags` stay clean.
- **Truncate marker is MDX, not HTML.** Use `{/* truncate */}` for the "read more" fold. `<!-- truncate -->` **breaks the build** (MDX rejects the `<!` — "Unexpected character `!`").
- Navbar/footer both link to `/blog`. RSS + Atom feeds are generated at `/blog/rss.xml` and `/blog/atom.xml`.
- **Known non-fatal noise:** `docusaurus-plugin-llms-txt` (v0.1.3) logs `[ERROR] Multiple sidebars found for route /blog/<post>` for each blog post — its `extractSectionName` requires a navbar item whose `sidebarId` matches the route's sidebar, and blog routes have none. The plugin catches this per-post, so the build stays green (exit 0); the post is just omitted from `llms.txt`. The plugin exposes no route/blog exclusion option, so this is expected until upstream fixes it (see the llms.txt caveat below).

## Critical conventions (these caused real bugs — follow them)

1. **Base path / links.** `baseUrl` is `/` and the docs plugin uses `routeBasePath: "docs"`, so every doc lives under `/docs`. Write internal doc links **with** the `/docs` prefix. Correct: `[Releases](/docs/dashboard/releases)`. Wrong: `/dashboard/releases` (missing `/docs`). `onBrokenLinks: "throw"` fails the build on a mismatch. Blog links use `/blog/…`; asset links (`/img/…`) stay as-is. Don't add the `/airborne` GitHub-Pages prefix anywhere — it's a CloudFront Origin Path, invisible to the site. (This `/docs`-prefix rule replaced the pre-2026-07-06 "no prefix" rule when the site left `baseUrl: "/docs/"`.)

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

## Deployment (GitHub Pages behind CloudFront)

The docs are **not** served by `airborne_server` (no `docs.rs`, no `docs_dist`, and the `Dockerfile` does not build them). Pipeline:

1. **Build + publish:** `.github/workflows/docs.yaml` builds `airborne_docs/` and publishes to **GitHub Pages** (`juspay.github.io/airborne`) via `actions/upload-pages-artifact` → `actions/deploy-pages`, on pushes to `main` under `airborne_docs/**` (or `workflow_dispatch`). One-time: repo Settings → Pages → Source: **GitHub Actions**. The build auto-emits `.nojekyll` (Pages needs it so `assets/` isn't Jekyll-processed).
2. **Serve:** **CloudFront** fronts `airborne.juspay.in`. Origin `juspay.github.io` with **Origin Path `/airborne`** (HTTPS-only; leave the Host header as the origin default — GitHub routes the project by it). Cache behaviors route `/docs/*`, `/blog/*`, `/assets/*`, `/img/*` (+ `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`) to that origin; the default behavior goes to the app frontend. The `/airborne` Origin Path maps the site's root paths onto the project-pages storage prefix, so `baseUrl` stays `/`.

- **Config is constant:** `url: "https://airborne.juspay.in"`, `baseUrl: "/"`, `trailingSlash: true` (no env overrides). `trailingSlash: true` is load-bearing — it stops GitHub Pages from 301-redirecting directory paths, whose `Location` would otherwise leak `/airborne` back through CloudFront and break navigation.
- **Cache invalidation is manual** (deliberately not in the workflow) — invalidate `/docs/*` `/blog/*` `/assets/*` `/img/*` after a deploy (asset filenames are content-hashed, so in practice mainly the HTML needs it).
- **robots.txt/sitemap:** the app frontend owns `airborne.juspay.in/` (and thus `/robots.txt`), so the docs don't control robots. `sitemap.xml` (routed to the docs origin at `airborne.juspay.in/sitemap.xml`) should be submitted via Search Console.

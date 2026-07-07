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
   Images live at `static/docs_static/img/screenshots/{light,dark}/<name>.png` — **you must provide both a light and a dark capture** (same filename in each folder). Light shows in light mode, dark in dark mode.

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
- **Search:** Algolia DocSearch via `themeConfig.algolia` (`@docusaurus/theme-search-algolia` is bundled in `preset-classic` — no extra dep). `appId`/`apiKey` are the **public search-only** credentials (safe to commit — do NOT put the Algolia *admin* key here). `indexName` must match the Algolia crawler's index. `contextualSearch: false` (single version/locale, so no `docusaurus_tag`/`language` facet filtering — avoids "no results" if the crawler doesn't index those facets).
  - **The index quality lives in the *crawler* config, not here.** A reference copy is committed at `airborne_docs/algolia-crawler.config.js` (the live one is in the Algolia Crawler dashboard; the file must stay a single self-contained `new Crawler({…})` — no top-level helper functions, the editor rejects them). Key lessons: (1) scope every `recordExtractor` selector to **`.theme-doc-markdown`** — Docusaurus's clean content container — or the crawler indexes the sidebar/breadcrumbs/TOC/footer and search returns raw junk chunks; (2) `lvl0` is derived from the URL section *inside* the extractor (e.g. `url.pathname.includes("/server/")` → "Server") so results group by section; (3) **`renderJavaScript: true` is required** — the API-reference (OpenAPI) pages render their params/schemas client-side, so with it off they index almost nothing (regular docs are SSG and fine either way). After changing the crawler config, **reindex**; the docs site needs no rebuild for search changes.

## Deployment (GitHub Pages behind CloudFront)

The docs are **not** served by `airborne_server` (no `docs.rs`, no `docs_dist`, and the `Dockerfile` does not build them). Pipeline:

1. **Build + publish:** `.github/workflows/docs.yaml` builds `airborne_docs/` and publishes to **GitHub Pages** (`juspay.github.io/airborne`) via `actions/upload-pages-artifact` → `actions/deploy-pages`, on pushes to `main` under `airborne_docs/**` (or `workflow_dispatch`). One-time: repo Settings → Pages → Source: **GitHub Actions**. The build auto-emits `.nojekyll` (Pages needs it so `assets/` isn't Jekyll-processed).
2. **Serve:** **CloudFront** fronts `airborne.juspay.in`. Origin `juspay.github.io` with **Origin Path `/airborne`** (HTTPS-only; leave the Host header as the origin default — GitHub routes the project by it). Cache behaviors route `/docs/*`, `/blog/*`, `/docs_static/*` (+ `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/llms-full.txt`) to that origin; the default behavior goes to the app frontend. The `/airborne` Origin Path maps the site's root paths onto the project-pages storage prefix, so `baseUrl` stays `/`.

## Asset paths (`/docs_static`)

Everything the docs origin serves lives under **one prefix, `/docs_static/`**, so CloudFront routes it with a single behavior and it never collides with the app's own `/assets/*`:
- **Bundles** → `/docs_static/assets/js`, `/docs_static/assets/css`. Relocated by `docsStaticAssetsPlugin` in `docusaurus.config.ts`, which overrides the rspack/webpack `output.filename`/`chunkFilename` and the CSS-extract plugin's `filename` (matched by constructor name containing `CssExtract` — it's `CssExtractRspackPlugin` because `@docusaurus/faster`/rspack is active). Production build only (`config.mode === "production"`), so the dev server keeps default paths + working HMR.
- **Static files** (favicon, logos, social card, screenshots) → `/docs_static/img/*`, by living in `static/docs_static/img/` and referenced with the `/docs_static/img/...` prefix (config `favicon`/`image`/logo, `src/components/Screenshot`).
- When adding assets: keep them under `/docs_static/` (don't reintroduce a bare `/img` or `/assets` ref, or CloudFront's `/assets/*` → app behavior will 404 it). After a build, `grep '<script.*src=/assets/\|<link.*href=/assets/' build/**/*.html` must be empty.

- **Config is constant:** `url: "https://airborne.juspay.in"`, `baseUrl: "/"`, `trailingSlash: true` (no env overrides). Canonical is `/foo/` (real content at `foo/index.html`). **`noSlashRedirectStubsPlugin`** (a `postBuild` hook in `docusaurus.config.ts`) is load-bearing: for every page it writes a small `foo.html` **redirect stub** (`<meta http-equiv=refresh>` to the root-relative `/foo/`; no domain hardcoded — the target page keeps its own absolute canonical). This keeps the no-slash → slash redirect **under our control on the public domain** instead of GitHub Pages' 301, whose absolute `Location` (`https://juspay.github.io/airborne/…`) would leak the origin through CloudFront. Because `foo.html` exists, Pages serves it directly (no Pages redirect); both `/foo` and `/foo/` return 200. It's a client meta-refresh, not a real 301 status (static hosting can't emit one; a true 301 would need the CloudFront Function we're avoiding). Test locally with the GH-Pages emulator, **not** `docusaurus serve` (which normalizes slashes itself).
- **Cache invalidation is manual** (deliberately not in the workflow) — invalidate `/docs/*` `/blog/*` `/docs_static/*` after a deploy (asset filenames are content-hashed, so in practice mainly the HTML needs it).
- **robots.txt/sitemap:** `airborne_docs/static/robots.txt` (allow-all + `Sitemap: https://airborne.juspay.in/sitemap.xml`) builds to the site root `/robots.txt`. Because the app owns `airborne.juspay.in/` by default, this only takes effect once CloudFront routes `/robots.txt` (and `/sitemap.xml`) to the docs origin — at which point the docs' robots.txt is the **domain-wide** one, so add any app-specific `Disallow:` rules there and coordinate with the app team. Submit `airborne.juspay.in/sitemap.xml` via Search Console.

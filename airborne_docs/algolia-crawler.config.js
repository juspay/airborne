/**
 * Algolia Crawler config for the Airborne documentation search — REFERENCE COPY.
 *
 * The live config lives in the Algolia Crawler dashboard (Crawler → Editor). This is
 * NOT built into the Docusaurus site (the site only configures the search *widget* in
 * themeConfig.algolia). Paste this into the editor, set `apiKey` to your Crawler ADMIN
 * (write) key — do NOT commit the real value — then Reindex.
 *
 * Improvements over the default DocSearch template:
 *   - Selectors scoped to `.theme-doc-markdown` (Docusaurus's clean content container),
 *     so the sidebar / breadcrumbs / TOC / footer are never indexed. That noise was what
 *     produced the "raw chunk" search results.
 *   - `lvl0` derived from the URL section inside the extractor (React Native SDK, Server,
 *     API Reference, …), so hits group by section instead of one flat "Documentation".
 *   - `renderJavaScript: true` — REQUIRED: the API-reference (OpenAPI) pages render their
 *     params/schemas client-side, so that content is not in the raw HTML.
 *   - `indexHeadings: true` — one record per heading, so results deep-link to the section.
 *   - `sitemaps` set + `/blog/**` added.
 */
new Crawler({
  appId: "<APP_ID>",
  indexPrefix: "",
  rateLimit: 8,
  startUrls: ["https://airborne.juspay.in/docs/"],
  renderJavaScript: true,
  maxDepth: 10,
  maxUrls: null,
  schedule: "on the 29 day of the month",
  sitemaps: ["https://airborne.juspay.in/sitemap.xml"],
  ignoreCanonicalTo: false,
  discoveryPatterns: [
    "https://airborne.juspay.in/docs/**",
    "https://airborne.juspay.in/blog/**",
  ],
  actions: [
    {
      indexName: "Airborne Documentation",
      pathsToMatch: [
        "https://airborne.juspay.in/docs/**",
        "https://airborne.juspay.in/blog/**",
      ],
      recordExtractor: ({ url, helpers }) => {
        const p = url.pathname;
        const section = p.includes("/react-native-sdk/")
          ? "React Native SDK"
          : p.includes("/react-native-cli/")
          ? "React Native CLI"
          : p.includes("/core-cli/")
          ? "Core CLI"
          : p.includes("/server/")
          ? "Server"
          : p.includes("/api-reference/")
          ? "API Reference"
          : p.includes("/dashboard/")
          ? "Dashboard"
          : p.includes("/guides/")
          ? "Guides"
          : p.includes("/concepts/")
          ? "Concepts"
          : p.startsWith("/blog")
          ? "Blog"
          : "Documentation";
        return helpers.docsearch({
          recordProps: {
            lvl1: [".theme-doc-markdown h1", "header h1", "article h1"],
            content: ".theme-doc-markdown p, .theme-doc-markdown li, .theme-doc-markdown td",
            lvl0: {
              selectors: "",
              defaultValue: section,
            },
            lvl2: ".theme-doc-markdown h2",
            lvl3: ".theme-doc-markdown h3",
            lvl4: ".theme-doc-markdown h4",
            lvl5: ".theme-doc-markdown h5",
            lvl6: ".theme-doc-markdown h6",
          },
          indexHeadings: true,
          aggregateContent: true,
          recordVersion: "v3",
        });
      },
    },
  ],
  safetyChecks: { beforeIndexPublishing: { maxLostRecordsPercentage: 30 } },
  initialIndexSettings: {
    "Airborne Documentation": {
      attributesForFaceting: [
        "type",
        "lang",
        "docusaurus_tag",
        "version",
        "language",
      ],
      attributesToRetrieve: [
        "hierarchy",
        "content",
        "anchor",
        "url",
        "url_without_anchor",
        "type",
      ],
      attributesToHighlight: ["hierarchy", "content"],
      attributesToSnippet: ["content:10"],
      camelCaseAttributes: ["hierarchy", "content"],
      searchableAttributes: [
        "unordered(hierarchy.lvl0)",
        "unordered(hierarchy.lvl1)",
        "unordered(hierarchy.lvl2)",
        "unordered(hierarchy.lvl3)",
        "unordered(hierarchy.lvl4)",
        "unordered(hierarchy.lvl5)",
        "unordered(hierarchy.lvl6)",
        "content",
      ],
      distinct: true,
      attributeForDistinct: "url",
      customRanking: [
        "desc(weight.pageRank)",
        "desc(weight.level)",
        "asc(weight.position)",
      ],
      ranking: [
        "words",
        "filters",
        "typo",
        "attribute",
        "proximity",
        "exact",
        "custom",
      ],
      highlightPreTag: '<span class="algolia-docsearch-suggestion--highlight">',
      highlightPostTag: "</span>",
      minWordSizefor1Typo: 3,
      minWordSizefor2Typos: 7,
      allowTyposOnNumericTokens: false,
      minProximity: 1,
      ignorePlurals: true,
      advancedSyntax: true,
      attributeCriteriaComputedByMinProximity: true,
      removeWordsIfNoResults: "allOptional",
    },
  },
  apiKey: "<CRAWL_API_KEY>",
});

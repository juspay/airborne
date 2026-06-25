import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Airborne",
  tagline: "Over-the-air updates for React Native, Android, and iOS",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
  },

  url: "https://airborne.juspay.in",
  baseUrl: "/",

  trailingSlash: true,

  organizationName: "juspay",
  projectName: "airborne",

  onBrokenLinks: "throw",

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  stylesheets: [
    {
      href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      type: "text/css",
    },
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/juspay/airborne/tree/main/airborne_docs/",
          // Docs live under /docs (baseUrl is "/"); the blog is a sibling at /blog.
          routeBasePath: "docs",
          // Renders both regular docs and the generated OpenAPI reference pages.
          docItemComponent: "@theme/ApiItem",
        },
        // Blog lives at /blog, a sibling of /docs (baseUrl is "/").
        blog: {
          routeBasePath: "blog",
          blogTitle: "Airborne blog",
          blogDescription: "Product updates, release notes, and engineering notes for Airborne OTA.",
          showReadingTime: true,
          blogSidebarTitle: "All posts",
          blogSidebarCount: "ALL",
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
            title: "Airborne blog",
            description: "Product updates, release notes, and engineering notes for Airborne OTA.",
            copyright: `Copyright © ${new Date().getFullYear()} Juspay Technologies.`,
          },
          // Fail the build only for structural issues; keep tag/author hygiene as warnings.
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        // @docusaurus/plugin-sitemap is bundled with preset-classic; configured here
        // (do not also add it to `plugins` — that would register it twice).
        sitemap: {
          lastmod: "date",
          changefreq: "weekly",
          priority: 0.5,
          filename: "sitemap.xml",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    "docusaurus-plugin-sass",
    // Generates /llms.txt and /llms-full.txt at build time for LLM consumers.
    [
      "docusaurus-plugin-llms-txt",
      {
        title: "Airborne documentation",
        description: "Over-the-air updates for React Native, Android, and iOS apps.",
        fullLLMsTxt: true,
      },
    ],
    [
      "docusaurus-plugin-openapi-docs",
      {
        id: "openapi",
        docsPluginId: "classic",
        config: {
          airborne: {
            specPath: "openapi/airborne.openapi.json",
            outputDir: "docs/api-reference/endpoints",
            sidebarOptions: {
              groupPathsBy: "tag",
            },
            hideSendButton: false,
          },
        },
      },
    ],
  ],

  themes: ["docusaurus-theme-openapi-docs", "@docusaurus/theme-mermaid"],

  themeConfig: {
    image: "img/airborne-social-card.png",
    mermaid: {
      theme: { light: "neutral", dark: "dark" },
    },
    colorMode: {
      defaultMode: "light",
      respectPrefersColorScheme: true,
    },
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: false,
      },
    },
    navbar: {
      title: "",
      logo: {
        alt: "Airborne",
        src: "img/airborne-logo-light.svg",
        srcDark: "img/airborne-logo-dark.svg",
        href: "/docs",
        width: 132,
      },
      items: [
        {
          to: "/docs/guides/integrate-react-native",
          label: "Guides",
          position: "left",
        },
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          label: "Documentation",
          position: "left",
        },
        {
          to: "/blog",
          label: "Blog",
          position: "left",
        },
        {
          href: "https://github.com/juspay/airborne",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Guides",
          items: [
            { label: "Integrate in React Native", to: "/docs/guides/integrate-react-native" },
            { label: "Integrate in Expo", to: "/docs/guides/integrate-react-native-expo" },
            { label: "Create & target a release", to: "/docs/guides/create-and-target-a-release" },
          ],
        },
        {
          title: "Reference",
          items: [
            { label: "React Native SDK", to: "/docs/react-native-sdk/integration/getting-started" },
            { label: "React Native CLI", to: "/docs/react-native-cli/getting-started" },
            { label: "Core CLI", to: "/docs/core-cli/getting-started" },
            { label: "Server", to: "/docs/server/overview" },
            { label: "Dashboard", to: "/docs/dashboard/overview" },
          ],
        },
        {
          title: "More",
          items: [
            { label: "Blog", to: "/blog" },
            { label: "GitHub", href: "https://github.com/juspay/airborne" },
            { label: "Juspay", href: "https://juspay.io" },
            { label: "Maven (airborne)", href: "https://central.sonatype.com/artifact/io.juspay/airborne" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Juspay Technologies. Airborne is open source under the Apache 2.0 license.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "kotlin", "swift", "groovy", "ruby", "diff", "toml", "yaml", "objectivec", "sql"],
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

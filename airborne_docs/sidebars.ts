import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
// Generated from the Smithy → OpenAPI spec by docusaurus-plugin-openapi-docs
// (npm run gen-api-docs). Grouped by tag; regenerate after changing smithy/models.
import openApiSidebar from "./docs/api-reference/endpoints/sidebar";

/**
 * Airborne documentation sidebar.
 *
 * Two top-level sections:
 *   1. Guides        – task-oriented, end-to-end walkthroughs
 *   2. Documentation – reference for the SDK, CLIs, server, and dashboard
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    "intro",
    "concepts/download-and-boot-flow",
    {
      type: "category",
      label: "Guides",
      collapsible: true,
      collapsed: false,
      items: [
        "guides/integrate-react-native",
        "guides/integrate-react-native-expo",
        "guides/create-and-target-a-release",
      ],
    },
    {
      type: "category",
      label: "Documentation",
      collapsible: true,
      collapsed: false,
      items: [
        {
          type: "category",
          label: "React Native SDK",
          link: { type: "doc", id: "react-native-sdk/overview" },
          items: [
            {
              type: "category",
              label: "Integration in React Native",
              items: [
                "react-native-sdk/integration/getting-started",
                "react-native-sdk/integration/install",
                "react-native-sdk/integration/android-setup",
                "react-native-sdk/integration/ios-setup",
                "react-native-sdk/integration/bundling-release-config",
                "react-native-sdk/integration/verify",
              ],
            },
            {
              type: "category",
              label: "Integration in React Native (Expo)",
              items: [
                "react-native-sdk/expo/getting-started",
                "react-native-sdk/expo/android-setup",
                "react-native-sdk/expo/ios-setup",
                "react-native-sdk/expo/bundling-release-config",
              ],
            },
            {
              type: "category",
              label: "References",
              items: [
                "react-native-sdk/reference/javascript-api",
                "react-native-sdk/reference/android-api",
                "react-native-sdk/reference/ios-api",
                "react-native-sdk/reference/callbacks-and-events",
              ],
            },
          ],
        },
        {
          type: "category",
          label: "Bare Integration (Advanced)",
          link: { type: "doc", id: "bare-integration/overview" },
          items: [
            "bare-integration/overview",
            "bare-integration/react-native",
            "bare-integration/expo",
            "bare-integration/reload-after-download",
          ],
        },
        {
          type: "category",
          label: "Airborne React Native CLI",
          link: { type: "doc", id: "react-native-cli/getting-started" },
          items: [
            "react-native-cli/getting-started",
            "react-native-cli/authentication",
            "react-native-cli/local-configuration",
            "react-native-cli/remote-files-and-packages",
            "react-native-cli/command-reference",
          ],
        },
        {
          type: "category",
          label: "Airborne Core CLI",
          link: { type: "doc", id: "core-cli/getting-started" },
          items: [
            "core-cli/getting-started",
            "core-cli/authentication",
            "core-cli/command-reference",
          ],
        },
        {
          type: "category",
          label: "Airborne Server",
          link: { type: "doc", id: "server/overview" },
          items: [
            "server/overview",
            "server/configuration",
            "server/running-locally",
            "server/deploy-ecs",
            "server/deploy-eks",
          ],
        },
        {
          type: "category",
          label: "API Reference",
          link: { type: "doc", id: "api-reference/overview" },
          items: [
            "api-reference/overview",
            "api-reference/authentication",
            "api-reference/conventions",
            ...openApiSidebar,
          ],
        },
        {
          type: "category",
          label: "Airborne Dashboard",
          link: { type: "doc", id: "dashboard/overview" },
          items: [
            "dashboard/overview",
            "dashboard/authentication-and-onboarding",
            "dashboard/organisations",
            "dashboard/users-and-roles",
            "dashboard/applications",
            "dashboard/files",
            "dashboard/packages",
            "dashboard/releases",
            "dashboard/dimensions",
            "dashboard/cohorts",
            "dashboard/remote-configs",
            "dashboard/views",
            "dashboard/access-tokens",
          ],
        },
      ],
    },
  ],
};

export default sidebars;

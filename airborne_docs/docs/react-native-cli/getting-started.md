---
title: Getting Started with the React Native CLI
description: Install airborne-devkit and learn the typical React Native OTA release workflow, from login to creating a release.
---

> Checkout-only commands: the published `airborne-devkit@0.45.0` does not include `init`, `bundle` or `publish`; its `configure` is different. Use the CLI from this checkout as described in [First OTA](../guides/first-ota.md) until a new package is published.


`airborne-devkit` is the **Airborne React Native CLI** — a high-level workflow tool for shipping Over-the-Air (OTA) updates to React Native apps. It scaffolds the local configuration files Airborne needs, bundles your JavaScript, uploads (or registers) the resulting files, assembles a package, and creates a release, all from a handful of commands tailored to a React Native project layout.

Under the hood it talks to the same Airborne API as the [Core CLI](/docs/core-cli/getting-started). In addition to its own workflow commands, `airborne-devkit` also re-exposes every low-level Core CLI operation (organisations, applications, dimensions, files, packages, releases) so you can drop down to them when you need finer control. See the [Core CLI command reference](/docs/core-cli/command-reference) for those.

## Installation

Install the CLI with npm:

```bash
# Install locally in your project
npm install airborne-devkit

# Or install globally for system-wide access
npm install -g airborne-devkit
```

**Usage:**

- **Local install** — run commands with `npx airborne-devkit <command>`, or wire them into your `package.json` scripts.
- **Global install** — run commands directly as `airborne-devkit <command>`.

This guide uses the `npx airborne-devkit <command>` form throughout.

:::note
Without configuration the CLI talks to `https://airborne.juspay.in`. To use a self-hosted server run `npx airborne-devkit configure --base-url <url>` in your project. The URL is saved in `<project>/.airborne/config.json`, so each project keeps its own server and nothing is written into the CLI installation. The `AIRBORNE_BASE_URL` environment variable overrides it for one command.
:::

## Get your client credentials

Every workflow starts by authenticating with a **client ID** and **client secret**. You generate these from the Airborne dashboard — see [access tokens in the dashboard](/docs/dashboard/access-tokens). Keep them out of version control; pass them through environment variables in CI.

## The typical release workflow

A full React Native OTA release with `airborne-devkit` follows these steps:

1. **Authenticate** — `npx airborne-devkit login --client_id <client-id> --client_secret <client-secret>`. Stores a token locally so subsequent commands are authenticated. See [Authentication](/docs/react-native-cli/authentication).
2. **Create the local Airborne config** — `npx airborne-devkit create-local-airborne-config`. Writes `airborne-config.json` describing your organisations, namespaces, and bundle entry/output files. See [Local configuration](/docs/react-native-cli/local-configuration).
3. **Bundle your JS** — `npx airborne-devkit bundle -p <platform>`. Runs the React Native (or Expo) bundler and writes, or refreshes, the `release_config.json` listing the index file and the other generated assets. It is safe to repeat and to run after `init`. (`create-local-release-config -p <platform>` does the first half only and refuses when a release config already exists.)
4. **Register or upload the files** — `npx airborne-devkit create-remote-files -p <platform> [--upload]`. Either uploads the bundled files to Airborne, or registers them as external URLs you host yourself. See [Remote files and packages](/docs/react-native-cli/remote-files-and-packages).
5. **Create a remote package** — `npx airborne-devkit create-remote-package -p <platform>`. Assembles the uploaded files into a deployable package on the server.
6. **Create a release** — `npx airborne-devkit CreateRelease ...` (a re-exposed Core CLI command). Promotes a package and config into a release that the SDK will serve.

In short:

```
login
  → create-local-airborne-config
    → bundle                        (bundles your JS)
      → create-remote-files         (upload or register URLs)
        → create-remote-package
          → CreateRelease
```

To do steps 3 to 6 and the ramp in one command, run `npx airborne-devkit publish -p <platform>`: it bundles, uploads, creates the package, prepares an exact-version release, ramps it and prints the exact conclude command (add `--conclude` to conclude immediately), reading the package and app versions for you. See the [first OTA walkthrough](/docs/guides/first-ota).

Steps 2–5 are the **Special Commands** documented in [Local configuration](/docs/react-native-cli/local-configuration) and [Remote files and packages](/docs/react-native-cli/remote-files-and-packages). Step 6 and any other resource operations are the low-level commands listed in the [Core CLI command reference](/docs/core-cli/command-reference); within `airborne-devkit` they are invoked as `npx airborne-devkit <Command>` and pick up your stored token automatically.

## Where things live

- `airborne-config.json` — project-level config, written at your project root.
- `release_config.json` — per-platform release config. On Android it lands at `android/app/src/main/assets/<namespace>/release_config.json`; on iOS at `ios/release_config.json`.
- `.airborne/` — holds your auth token (`credentials.json`) and an upload bookkeeping file (`mappings.json`). The CLI adds `.airborne` to your `.gitignore` automatically.

## Next

- [Authentication](/docs/react-native-cli/authentication)
- [Local configuration](/docs/react-native-cli/local-configuration)
- [Remote files and packages](/docs/react-native-cli/remote-files-and-packages)
- [Command reference](/docs/react-native-cli/command-reference)

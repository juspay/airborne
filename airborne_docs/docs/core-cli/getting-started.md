---
title: Getting Started with the Core CLI
description: Install airborne-core-cli, point it at your Airborne API with configure --base-url, and learn how it relates to the React Native CLI.
---

`airborne-core-cli` is the **Airborne Core CLI** — a low-level, thin client over the Airborne API. It is generated directly from the Airborne Smithy API model, so it mirrors the API one-to-one: every operation (organisations, applications, dimensions, files, packages, releases, and user) is exposed as a command with the same parameters as the underlying request.

Use the Core CLI when you want direct, scriptable access to individual API operations — for example in CI pipelines, automation, or when integrating Airborne into a non-React-Native workflow.

## Core CLI vs. React Native CLI

There are two Airborne CLIs, and they are distinct:

- **Core CLI (`airborne-core-cli`)** — the low-level, generated client documented here. You configure a base URL, obtain a token with `PostLogin`, and pass that token to each command via `--token`.
- **React Native CLI (`airborne-devkit`)** — a high-level workflow tool for React Native projects. It scaffolds config, bundles JS, uploads files, and creates releases. It also **re-exposes every Core CLI operation**, injecting your stored token automatically so you don't pass `--token`. See [Getting started with the React Native CLI](/react-native-cli/getting-started).

If you are shipping OTA updates to a React Native app, start with `airborne-devkit`. If you need raw access to the API, use `airborne-core-cli`.

## Installation

Install the CLI with npm:

```bash
# Install locally in your project
npm install airborne-core-cli

# Or install globally for system-wide access
npm install -g airborne-core-cli
```

- **Local install** — run commands with `npx airborne-core-cli <command>`.
- **Global install** — run commands directly as `airborne-core-cli <command>`.

This guide uses the `airborne-core-cli <command>` form.

## Configure the API base URL

Before running any operation, point the CLI at an Airborne API endpoint with `configure`. This is typically the first command you run.

```bash
airborne-core-cli configure --base-url <url>
```

**Parameters:**

| Parameter           | Required | Description                           |
| ------------------- | -------- | ------------------------------------- |
| `-u, --base-url`    | Yes      | Base URL of the Airborne API endpoint. |

Examples:

```bash
# Hosted Airborne API
airborne-core-cli configure --base-url https://airborne.juspay.in

# Self-hosted server
airborne-core-cli configure --base-url http://localhost:3000
```

The base URL is persisted to a `.config` file alongside the CLI package and is reused by every subsequent command. Re-run `configure` at any time to change it.

:::note
The Core CLI shares this configuration with `airborne-devkit`. If you set the base URL through either CLI, both use it.
:::

## Authenticate

Operations require a bearer token. You obtain one with the `PostLogin` command using a client ID and client secret generated from the dashboard, then pass the token to other commands via `--token`. See [Authentication](/core-cli/authentication) for the full flow, and [access tokens in the dashboard](/dashboard/access-tokens) for obtaining credentials.

## Input methods

Every command supports three ways of supplying parameters:

- **Individual flags** — `--application myapp --organisation myorg`
- **JSON parameters file** — `airborne-core-cli CreateApplication @params.json`
- **Mixed** — `airborne-core-cli CreateApplication @params.json --application override-value` (flags override matching keys in the file)

The parameters file must have a `.json` extension and be referenced with a leading `@`. See the [command reference](/core-cli/command-reference) for per-command details.

## Next

- [Authentication](/core-cli/authentication)
- [Command reference](/core-cli/command-reference)

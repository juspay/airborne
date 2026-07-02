---
title: Command Reference
description: A compact reference of the airborne-devkit workflow commands, the re-exposed Core CLI operations, and the three input methods.
---

This page summarizes the commands `airborne-devkit` provides. There are two groups: the **devkit-specific commands** (login plus the five special workflow commands), and the **re-exposed Core CLI operations** for working with organisations, applications, dimensions, files, packages, and releases.

All commands accept `-h, --help` for inline usage, and `-V, --version` is available on the CLI itself.

## Devkit-specific commands

| Command                         | Description                                                                 |
| ------------------------------- | --------------------------------------------------------------------------- |
| `login`                         | Authenticate with client credentials and store a token locally. See [Authentication](/react-native-cli/authentication). |
| `create-local-airborne-config`  | Scaffold `airborne-config.json` for your project. See [Local configuration](/react-native-cli/local-configuration#create-local-airborne-config). |
| `create-local-release-config`   | Bundle your JS and write a per-platform `release_config.json`. See [Local configuration](/react-native-cli/local-configuration#create-local-release-config). |
| `update-local-release-config`   | Re-bundle and update an existing `release_config.json`. See [Local configuration](/react-native-cli/local-configuration#update-local-release-config). |
| `create-remote-files`           | Upload or register the bundled files with Airborne. See [Remote files and packages](/react-native-cli/remote-files-and-packages#create-remote-files). |
| `create-remote-package`         | Assemble registered files into a deployable package. See [Remote files and packages](/react-native-cli/remote-files-and-packages#create-remote-package). |

## Core CLI operations under airborne-devkit

Every low-level Airborne API operation is also available through `airborne-devkit`, invoked as:

```bash
npx airborne-devkit <Command> [options]
```

These commands behave exactly like their [Core CLI](/core-cli/command-reference) counterparts, with one convenience: `airborne-devkit` injects your stored authentication token automatically, so you never pass `--token`.

The available operations are:

- **Organisation** — `CreateOrganisation`, `ListOrganisations`, `RequestOrganisation`
- **Application** — `CreateApplication`, `GetUser`
- **Dimension** — `CreateDimension`, `UpdateDimension`, `DeleteDimension`, `ListDimensions`
- **File** — `CreateFile`, `UploadFile`, `ListFiles`, `ListFileGroups`
- **Package** — `CreatePackage`, `ListPackages`
- **Release** — `CreateRelease`, `GetRelease`, `ListReleases`, `ServeRelease`, `ServeReleaseV2`

For the full parameter tables and examples for each of these, see the [Core CLI command reference](/core-cli/command-reference). (When using them through `airborne-devkit`, omit the `--token` parameter shown there.)

## Input methods

Every command — both devkit-specific and re-exposed — supports three ways of supplying parameters.

### Method 1 — Individual flags

```bash
npx airborne-devkit CreateApplication \
  --application myapp \
  --organisation myorg
```

### Method 2 — JSON parameters file

Pass a `.json` file prefixed with `@`:

```bash
npx airborne-devkit CreateApplication @params.json
```

Where `params.json` contains:

```json
{
  "application": "myapp",
  "organisation": "myorg"
}
```

### Method 3 — Mixed (JSON file + flag overrides)

Combine a parameters file with individual flags. Flag values override matching keys in the JSON file:

```bash
npx airborne-devkit CreateApplication @params.json --application override-value
```

:::note
The parameters file must have a `.json` extension and be referenced with a leading `@` (for example `@params.json`). Any value you pass as a flag takes precedence over the same key in the file.
:::

## See also

- [Getting started](/react-native-cli/getting-started)
- [Authentication](/react-native-cli/authentication)
- [Local configuration](/react-native-cli/local-configuration)
- [Remote files and packages](/react-native-cli/remote-files-and-packages)
- [Core CLI command reference](/core-cli/command-reference)

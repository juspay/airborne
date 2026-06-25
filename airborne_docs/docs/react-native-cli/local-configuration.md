---
title: Local Configuration
description: Scaffold and maintain the local airborne-config.json and per-platform release_config.json files with the React Native CLI.
---

`airborne-devkit` keeps two kinds of local configuration in your React Native project:

- **`airborne-config.json`** — a project-level file describing your organisations, namespaces, JavaScript entry file, and per-platform bundle output paths. Created once with `create-local-airborne-config`.
- **`release_config.json`** — a per-platform file that lists the bundled index file and the rest of the generated assets, along with the boot and release-config timeouts. Created with `create-local-release-config` and modified with `update-local-release-config`.

All three commands accept an optional `[directoryPath]` as the first argument and default to the current working directory. When required values are omitted, the commands prompt for them interactively.

## create-local-airborne-config

Initializes Airborne in your React Native project by writing `airborne-config.json` at the project root.

```bash
# Interactive mode (recommended)
npx airborne-devkit create-local-airborne-config

# With all options
npx airborne-devkit create-local-airborne-config [directoryPath] \
  --android-organisation <android-organisation> \
  --ios-organisation <ios-organisation> \
  --android-namespace <android-namespace> \
  --ios-namespace <ios-namespace> \
  -j <js-entry-file> \
  -a <android-index-file> \
  -i <ios-index-file> \
  -e
```

**Parameters:**

| Parameter                  | Type   | Required | Description                                                            |
| -------------------------- | ------ | -------- | ---------------------------------------------------------------------- |
| `[directoryPath]`          | string | No       | Directory where the config is created (defaults to the current directory). |
| `--android-organisation`   | string | No       | Organisation name for Android.                                         |
| `--ios-organisation`       | string | No       | Organisation name for iOS.                                             |
| `--android-namespace`      | string | No       | Namespace or application name for Android.                             |
| `--ios-namespace`          | string | No       | Namespace or application name for iOS.                                 |
| `-j, --js-entry-file`      | string | No       | Path to the JavaScript entry file.                                     |
| `-a, --android-index-file` | string | No       | Path to the Android bundle output file.                                |
| `-i, --ios-index-file`     | string | No       | Path to the iOS bundle output file.                                    |
| `-e, --expo`               | flag   | No       | Indicates the project uses Expo.                                       |
| `--hermes-enabled`         | flag   | No       | Enables the Hermes engine for the bundle.                              |

In interactive mode you are asked whether the project uses Expo (and whether Hermes is enabled) first, then for each organisation, namespace, and file path. Sensible defaults are offered: the JS entry file defaults to `index.js` (`node_modules/expo-router/entry.js` for Expo), the Android index file to `index.android.bundle`, and the iOS index file to `main.jsbundle`.

The resulting `airborne-config.json` looks like this:

```json
{
  "hermes_enabled": false,
  "expo": false,
  "js_entry_file": "index.js",
  "android": {
    "organisation": "MyCompany",
    "namespace": "MyApp",
    "index_file_path": "index.android.bundle"
  },
  "ios": {
    "organisation": "MyCompany",
    "namespace": "MyApp",
    "index_file_path": "main.jsbundle"
  }
}
```

:::note
The command fails if an `airborne-config.json` already exists in the target directory. Edit the existing file directly, or remove it and re-run.
:::

## create-local-release-config

Bundles your JavaScript for a platform and writes a `release_config.json` describing the package. The command runs the React Native bundler (`react-native bundle`) — or the Expo bundler (`expo export:embed`) when the project is marked as Expo — and, when Hermes is enabled, compiles the Hermes bytecode bundle. It then records the generated index file and every other generated asset.

```bash
# Interactive mode (recommended)
npx airborne-devkit create-local-release-config

# With platform specified
npx airborne-devkit create-local-release-config -p android

# With all options
npx airborne-devkit create-local-release-config [directoryPath] \
  -p <platform> \
  -b <boot-timeout> \
  -r <release-config-timeout>
```

**Parameters:**

| Parameter                       | Type               | Required | Description                                                            |
| ------------------------------- | ------------------ | -------- | ---------------------------------------------------------------------- |
| `[directoryPath]`               | string             | No       | Directory where the config is created (defaults to the current directory). |
| `-p, --platform`                | `android` or `ios` | No       | Target platform. Prompted for if omitted.                             |
| `-b, --boot-timeout`            | number             | No       | Boot timeout in milliseconds (must be a positive number). Defaults to `4000`. |
| `-r, --release-config-timeout`  | number             | No       | Release config timeout in milliseconds (must be a positive number). Defaults to `4000`. |

Where the file lands depends on the platform:

- **Android** — `android/app/src/main/assets/<namespace>/release_config.json`
- **iOS** — `ios/release_config.json` (a Ruby helper also wires the config into the iOS project)

A freshly generated `release_config.json` has this shape, with `url` and `checksum` fields left empty until you run [`create-remote-files`](/docs/react-native-cli/remote-files-and-packages):

```json
{
  "version": "",
  "config": {
    "version": "",
    "boot_timeout": 4000,
    "release_config_timeout": 4000,
    "properties": {}
  },
  "package": {
    "name": "MyApp",
    "version": "",
    "index": {
      "file_path": "index.android.bundle",
      "url": "",
      "checksum": ""
    },
    "important": [
      { "file_path": "assets/...", "url": "" }
    ],
    "lazy": []
  },
  "resources": []
}
```

:::note
`create-local-release-config` requires an existing `airborne-config.json` in the directory. It fails if a release config for the chosen platform already exists — use `update-local-release-config` to modify it instead.
:::

## update-local-release-config

Re-bundles the JavaScript and updates an existing `release_config.json` for a platform, preserving fields such as `properties` and `resources` while refreshing the generated file list and any timeouts you pass.

```bash
# Interactive mode
npx airborne-devkit update-local-release-config

# Update a specific platform
npx airborne-devkit update-local-release-config -p android

# Update timeouts
npx airborne-devkit update-local-release-config -p ios -b 45000 -r 90000
```

**Parameters:**

| Parameter               | Type               | Required | Description                                                     |
| ----------------------- | ------------------ | -------- | --------------------------------------------------------------- |
| `[directoryPath]`       | string             | No       | Directory containing the config (defaults to the current directory). |
| `-p, --platform`        | `android` or `ios` | No       | Target platform. Prompted for if omitted.                       |
| `-b, --boot-timeout`    | number             | No       | New boot timeout in milliseconds (must be a positive number).   |
| `-r, --release-timeout` | number             | No       | New release config timeout in milliseconds (must be a positive number). |

Only the timeout values you supply are changed; any others remain as they were. The command requires both an existing `airborne-config.json` and an existing `release_config.json` for the platform, and fails if the release config is missing — use `create-local-release-config` for that.

## Next

- [Remote files and packages](/docs/react-native-cli/remote-files-and-packages)
- [Command reference](/docs/react-native-cli/command-reference)

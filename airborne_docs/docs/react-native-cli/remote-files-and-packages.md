---
title: Remote Files and Packages
description: Upload or register your bundled React Native files and assemble them into a deployable package with the React Native CLI.
---

Once you have a local `release_config.json` (see [Local configuration](/react-native-cli/local-configuration)), the next two steps push those files to Airborne and bundle them into a deployable package:

- **`create-remote-files`** — takes every file listed in the local release config (index, important, lazy, and resources) and either uploads them to Airborne storage or registers them as external URLs. It then writes the resulting URLs and checksums back into `release_config.json`.
- **`create-remote-package`** — reads the now-populated release config and creates a package on the server from the registered file IDs.

Both commands accept an optional `[directoryPath]` first argument (defaulting to the current directory), require an existing `airborne-config.json` and `release_config.json`, and require you to have [logged in](/react-native-cli/authentication) first.

## create-remote-files

Processes the local bundle files for a platform and makes them available to Airborne.

```bash
# Register remote records pointing at external URLs (prompts for a base URL)
npx airborne-devkit create-remote-files -p android

# Upload the files directly to Airborne storage
npx airborne-devkit create-remote-files -p ios --upload

# With a custom tag
npx airborne-devkit create-remote-files -p android -t "v1.2.0" --upload
```

**Parameters:**

| Parameter         | Type               | Required | Description                                                             |
| ----------------- | ------------------ | -------- | ----------------------------------------------------------------------- |
| `-p, --platform`  | `android` or `ios` | Yes      | Target platform. Prompted for if omitted.                               |
| `-t, --tag`       | string             | No       | Tag applied to the files for identification and versioning. The reserved value `__default__` is not allowed. |
| `-u, --upload`    | flag               | No       | Upload files directly to Airborne instead of registering external URLs. |
| `[directoryPath]` | string             | No       | Directory containing the release config (defaults to the current directory). |

### Upload vs. external URLs

`create-remote-files` works in one of two modes:

- **Upload mode (`--upload`)** — each file is read from your local build output, its SHA-256 checksum is computed, and the file is uploaded to Airborne storage (internally via the Core CLI `UploadFile` operation). Airborne hosts the bytes for you. Files whose checksum already matches a previous upload are skipped.
- **External URL mode (default)** — you are prompted for a base URL, and each file is registered as a record pointing at `<base-url>/<file_path>` (internally via the Core CLI `CreateFile` operation). You are responsible for hosting the actual files at those URLs on your own CDN or server.

In both modes the command processes the index file, then the `important`, `lazy`, and `resources` lists from the release config, and writes the returned `url` (and `checksum`, for uploads) back into `release_config.json`. It also records an upload-to-file-ID mapping in `.airborne/mappings.json`, which the next step uses to build the package.

:::note
Tags let you keep multiple versions of the same file path distinct. If you do not pass `-t`, files are stored under an internal default tag.
:::

## create-remote-package

Assembles the registered files into a deployable package on the Airborne server.

```bash
# Interactive mode
npx airborne-devkit create-remote-package

# With platform specified
npx airborne-devkit create-remote-package -p android

# With a custom tag
npx airborne-devkit create-remote-package -p ios -t "production-v1.2.0"
```

**Parameters:**

| Parameter         | Type               | Required | Description                                                             |
| ----------------- | ------------------ | -------- | ----------------------------------------------------------------------- |
| `-p, --platform`  | `android` or `ios` | Yes      | Target platform. Prompted for if omitted.                               |
| `-t, --tag`       | string             | No       | Tag applied to the package for identification and versioning. The reserved value `__default__` is not allowed. |
| `[directoryPath]` | string             | No       | Directory containing the release config (defaults to the current directory). |

### How the package is assembled

The command reads the local `release_config.json` and resolves each file to the file ID recorded in `.airborne/mappings.json` during `create-remote-files`:

- The **index** file becomes the package's index.
- The **important**, **lazy**, and **resources** entries are collected into the package's file list.

It then creates the package on the server (internally via the Core CLI `CreatePackage` operation) and writes the new package version back into `release_config.json`.

:::caution
You must run `create-remote-files` before `create-remote-package`. If a file referenced in the release config has no mapping (because it was never uploaded or registered), package creation fails with a "missing mapping" error.
:::

## After creating the package

With a package in place you can create a **release** that the SDK will serve. Releases are created with the re-exposed Core CLI `CreateRelease` command:

```bash
npx airborne-devkit CreateRelease @params.json
```

See the [Core CLI command reference](/core-cli/command-reference#createrelease) for the full parameter set, and the [React Native CLI command reference](/react-native-cli/command-reference) for how the re-exposed commands and input methods work.

## Next

- [Command reference](/react-native-cli/command-reference)
- [Core CLI command reference](/core-cli/command-reference)

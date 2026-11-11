---
title: JavaScript API
description: The JavaScript functions exposed by airborne-react-native for reading the release config, bundle path, and file contents the native SDK downloaded.
---

The `airborne-react-native` package exposes a small set of JavaScript functions for reading what the native SDK downloaded — the release config, the bundle path, and the contents of individual files inside the downloaded package. Each function takes the **namespace** (the application/namespace identifier you configured in the native integration) and returns a `Promise`.

This API is identical across the [plain React Native](/docs/react-native-sdk/integration/getting-started) and [Expo](/docs/react-native-sdk/expo/getting-started) tracks.

:::note[Not available in Expo Go]
These functions are backed by a native module. They throw a linking error if the native module is not present — for example in Expo Go, or if you have not rebuilt the app after installing the package.
:::

## readReleaseConfig

Reads the release configuration that the native SDK downloaded for the given namespace.

```typescript
function readReleaseConfig(nameSpace: string): Promise<string>
```

| Parameter | Type | Description |
| --- | --- | --- |
| `nameSpace` | `string` | The application/namespace identifier whose release config to read. |

**Returns:** `Promise<string>` — the release config as a JSON string. Reject if the config cannot be read.

```typescript
import { readReleaseConfig } from 'airborne-react-native';

const handleReadReleaseConfig = async () => {
  try {
    const config = await readReleaseConfig('airborne-example');
    console.log(config);
  } catch (error) {
    console.error(error);
  }
};
```

## getBundlePath

Returns the path to the downloaded JS bundle for the given namespace.

```typescript
function getBundlePath(nameSpace: string): Promise<string>
```

| Parameter | Type | Description |
| --- | --- | --- |
| `nameSpace` | `string` | The application/namespace identifier whose bundle path to return. |

**Returns:** `Promise<string>` — the file path to the bundle. When no downloaded bundle is available, the native layer falls back to the bundled asset path.

```typescript
import { getBundlePath } from 'airborne-react-native';

const handleGetBundlePath = async () => {
  try {
    const path = await getBundlePath('airborne-example');
    console.log(path);
  } catch (error) {
    console.error(error);
  }
};
```

## getFileContent

Reads the content of a file from the downloaded bundle for the given namespace.

```typescript
function getFileContent(nameSpace: string, filePath: string): Promise<string>
```

| Parameter | Type | Description |
| --- | --- | --- |
| `nameSpace` | `string` | The application/namespace identifier the file belongs to. |
| `filePath` | `string` | The relative path of the file within the downloaded package. |

**Returns:** `Promise<string>` — the file content as a string. Reject if the file cannot be read or does not exist, or if `filePath` is absolute or has a `..` component.

```typescript
import { getFileContent } from 'airborne-react-native';

const handleGetFileContent = async () => {
  try {
    const content = await getFileContent('airborne-example', 'test.js');
    console.log(content);
  } catch (error) {
    console.error(error);
  }
};
```

## markBootSuccess

Acknowledges that the running OTA package booted healthily. Only needed when the host app has opted in to the [boot guard](#boot-guard); otherwise it is a no-op.

```typescript
function markBootSuccess(namespace: string): Promise<void>
```

| Parameter | Type | Description |
| --- | --- | --- |
| `namespace` | `string` | The application/namespace identifier the native SDK was initialized with. |

**Returns:** `Promise<void>`. Rejects if the namespace is unknown: on native, no SDK instance exists for it; on web, `bootAirborne` has not run for it. Resolves without doing anything when the guard is off or the launch booted the bundled package. On web it works from the OTA bundle even though that bundle carries its own copy of the package.

Call it once, after your first screen has rendered:

```typescript
import { useEffect } from 'react';
import { markBootSuccess } from 'airborne-react-native';

export default function App() {
  useEffect(() => {
    markBootSuccess('airborne-example').catch(console.error);
  }, []);
  // ...
}
```

### Boot guard

The boot guard is **off by default**. Turn it on natively: on Android, return `true` from `AirborneInterface.bootGuardEnabled()`; on iOS, from `AirborneDelegate.bootGuardEnabled()`. On web, pass `bootGuardEnabled: true` to `bootAirborne`. When it is on:

- A launch counts as an attempt when an OTA package's bundle is handed over for execution. On Android this is `Airborne.getBundlePath()` (the React Native host's `getJSBundleFile`) or `Airborne.prepareBoot()`. On iOS it is the bundle URL delivered to `startApp(indexBundleURL:)` or returned by `getIndexBundlePath()`. On web it is `bootAirborne`. Only the first such call per process (on web, per page) counts. The JS `getBundlePath()` never counts, and bundled boots are never counted.
- Android process starts that never load the bundle, such as a push wake-up without headless JS, do not count. On iOS, the SDK cannot tell whether the host loads the URL it delivers to `startApp`, so a launch where `startApp` fires but the host does not run JS, such as a background launch, still counts.
- On web, a tab that is still starting the same package does not count against it for up to 30 seconds, so opening several tabs at once is safe.
- `markBootSuccess` clears the attempt count and records the package as the last good one.
- If a package has two unacknowledged boots, the next launch blocks it. The app then runs the last acknowledged package if there is one, otherwise the bundled package, and emits a `rollback` event.
- The block is lifted only once the server delivers a different package and it has been fully installed. A blocked version that is still being served emits `blocked-package` and is not installed.
- Guard state is discarded when the app binary changes (on web, when the bundled package version changes) or when the guard is turned off.
- Two launches that end before `markBootSuccess` runs are treated as failed boots, including quick kills or reloads. The threshold is fixed at two on every platform.
- If the guard cannot save its state, for example because storage is full, it stays inactive for that launch and reports an error event (`boot_guard_error` / `boot_guard_persist_failed` on native, an `error` event on web). It never stops the app from booting.

## Web

On web, the package resolves to a browser build (the `browser` export condition). There is no native module: the host page boots the OTA bundle itself with `bootAirborne`, and the functions above read what it loaded. `readReleaseConfig`, `getFileContent`, `getBundlePath` and `markBootSuccess` keep the same signatures. `getFileContent` fetches the file and rejects on HTTP errors or unknown paths.

```typescript
// Host page
import { bootAirborne } from 'airborne-react-native/web';
import bundledReleaseConfig from './release_config.json';

await bootAirborne({
  releaseConfigUrl: 'https://airborne.example.com/release/MyCompany/MyApp',
  namespace: 'MyApp',
  dimensions: { app_version: '1.0.0' },
  bundled: { releaseConfig: bundledReleaseConfig, baseUrl: '/ota/' },
  bootGuardEnabled: true,
  onEvent: (event) => console.log(event),
});
```

Import `bootAirborne` from `airborne-react-native/web` in the host page. App code imports from `airborne-react-native` as on native. TypeScript only picks up the web-only `getFileUrl` from the root import when `customConditions: ["browser"]` is set in `tsconfig.json`.

`bootAirborne` fetches the release config within `release_config_timeout`. It downloads the package into Cache Storage, verifying each file against its SHA-256 `checksum`, and races that download against `boot_timeout`. Then it injects whichever bundle is ready: the cached OTA package, or the bundled files under `baseUrl`. A package that misses the timeout keeps downloading and is used on the next load. Cached files are verified again before they run. A file is rejected if it cannot be verified, which happens when `crypto.subtle` is unavailable on an insecure origin. Every downloaded file must also list a SHA-256 `checksum`, in hex or base64. If a release's index or any important file has none, the loader refuses the whole package, reports an `error` event naming the files, and boots the cached package, or else the bundled one. A lazy file or resource without a checksum is skipped (and reported) and the rest of the package still runs. A cached file is never reused by URL alone. The page's own bundled files are not subject to this rule. A file registered as an external URL may have no checksum, and a package that needs one is refused on web. On web, both timeouts must be between 1 and 60000 ms; any other value falls back to 1000 ms. Lazy files and resources are published after the bundle starts, and `getFileContent` and `getFileUrl` wait for them. A resource that fails to update keeps its previous or bundled copy.

`onEvent` receives `{ type: 'error', message, packageVersion? }` when something fails without stopping the boot:

- an OTA bundle could not run, so the bundled package runs instead;
- a release was refused because its index or an important file lists no checksum, so the cached or bundled package runs instead;
- state could not be saved to `localStorage`;
- a package or its lazy files failed to download in the background (reported once per package per load);
- an acknowledged package's cached files were gone, so it was not recorded as last good.

With the boot guard on, it also receives `{ type: 'rollback' | 'blocked-package', packageVersion }`, with the same meaning as the native [boot guard events](/docs/react-native-sdk/reference/callbacks-and-events#boot-guard-events).

The OTA bundle runs from a `blob:` URL, so a Content Security Policy must allow `blob:` in `script-src`. Allow it in `connect-src` too if the app reads files with `getFileContent`.

The web-only `getFileUrl(namespace, filePath)` returns a URL usable in `<img src>` for a downloaded file, or `null`.

All requests are cross-origin from the page, so two servers need CORS:

- The release server must allow the page's origin through [`RELEASE_CORS_ALLOWED_ORIGINS`](/docs/server/configuration). A CDN in front of `/release` must include `Origin` in its cache key, or forward it.
- The file host (S3 bucket or CDN) must return `Access-Control-Allow-Origin` for the page's origin on `GET`. Otherwise every download fails and the page keeps booting the bundled package. `airborne_server/scripts/init-localstack.sh` shows a bucket CORS rule for local development.

## Default export

On native, the package's default export is the underlying native module. Prefer the named functions above; they are thin wrappers over `Airborne.readReleaseConfig`, `Airborne.getFileContent`, `Airborne.getBundlePath` and `Airborne.markBootSuccess`. On web, the default export is a plain object with the same functions plus `getFileUrl`.

```typescript
import Airborne from 'airborne-react-native';
```

## See also

- [Android API](/docs/react-native-sdk/reference/android-api) and [iOS API](/docs/react-native-sdk/reference/ios-api) — the native callbacks behind these functions.
- [Callbacks & events](/docs/react-native-sdk/reference/callbacks-and-events) — the SDK event stream.

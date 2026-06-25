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

**Returns:** `Promise<string>` — the file content as a string. Reject if the file cannot be read or does not exist.

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

## Default export

The package's default export is the underlying native module. Prefer the named functions above; they are thin wrappers over `Airborne.readReleaseConfig`, `Airborne.getFileContent`, and `Airborne.getBundlePath`.

```typescript
import Airborne from 'airborne-react-native';
```

## See also

- [Android API](/docs/react-native-sdk/reference/android-api) and [iOS API](/docs/react-native-sdk/reference/ios-api) — the native callbacks behind these functions.
- [Callbacks & events](/docs/react-native-sdk/reference/callbacks-and-events) — the SDK event stream.

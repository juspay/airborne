---
title: Verify the Integration
description: Confirm Airborne boots, serves the OTA bundle, and emits lifecycle events — plus troubleshooting for common issues.
---

After wiring up [Android](/docs/react-native-sdk/integration/android-setup) and [iOS](/docs/react-native-sdk/integration/ios-setup) and [bundling the release config](/docs/react-native-sdk/integration/bundling-release-config), confirm the SDK actually boots your app from an Airborne-managed bundle.

## Observe SDK lifecycle events

The fastest signal is the `onEvent` callback you implemented natively. It emits a stream of lifecycle events as the SDK initializes, fetches the release config, downloads packages and resources, and boots. Add a log line in `onEvent` (the integration snippets already do):

```kotlin
// Android — inside AirborneInterface.onEvent
Log.d("Airborne", "Event: $label - $key")
```

```swift
// iOS — inside AirborneDelegate.onEvent
print("Event: \(key) = \(value)")
```

On a healthy first boot you should see, roughly in order:

- `first_time_setup` → `started`, then `completed`
- `ota_update` → `release_config_fetch` (with `status: 200`)
- `ota_update` → `package_update_download_started`, then `package_update_result` (with `result: "SUCCESS"`)
- `ApplicationManager` → `boot` (carrying the resolved `release_config_version`, `config_version`, and `package_version`)

The terminating `boot` event means Airborne handed React Native a bundle and the app is running from it. For the full event catalogue, see [Callbacks & Events](/docs/react-native-sdk/reference/callbacks-and-events).

## Confirm the bundle path is served

You can also confirm the OTA bundle from JavaScript using the [JavaScript API](/docs/react-native-sdk/reference/javascript-api). `getBundlePath` returns the path the native SDK is serving, and `readReleaseConfig` returns the release config it resolved:

```tsx
import { getBundlePath, readReleaseConfig } from "airborne-react-native";

async function checkAirborne() {
  const path = await getBundlePath("<namespace>");
  const config = await readReleaseConfig("<namespace>");
  console.log("Bundle path:", path);
  console.log("Release config:", config);
}
```

A non-empty bundle path under your app's data directory (rather than the default in-binary bundle) confirms Airborne is serving the OTA copy.

## What a successful boot looks like

- The app launches normally, with a brief pause on first run while the release config and package download.
- `onEvent` emits the lifecycle sequence ending in a `boot` event.
- `getBundlePath` returns an Airborne-managed path, and `readReleaseConfig` returns the expected versions.
- Subsequent launches boot faster because the downloaded package is reused, while the SDK checks for updates in the background.

## Troubleshooting

**Boot times out / app falls back to the bundled assets every launch**
The release config or downloads are not completing within the boot/release timeout. Check that `release_config_fetch` returns `status: 200`. A non-200 status, a network error, or a slow connection causes the SDK to boot from the [bundled release config](/docs/react-native-sdk/integration/bundling-release-config). Watch for a `read_release_config_error` event, which carries the underlying error.

**Namespace mismatch**
The namespace must be identical in three places: the `<application/namespace-name>` segment of your release URL, the value returned by `getNamespace()` (Android) / `namespace()` (iOS), and the Android assets folder `app/src/main/assets/<namespace>/`. A mismatch means the SDK looks in the wrong place and cannot find the bundle.

**Missing Maven repository (Android build fails to resolve the SDK)**
If Gradle cannot resolve the Airborne native dependency, the Maven repository is not registered. Add `maven { url "https://maven.juspay.in/jp-build-packages/hyper-sdk/" }` to `build.gradle` or `settings.gradle` as described in [Install the SDK](/docs/react-native-sdk/integration/install).

**`release_config.json` not added to the Xcode target (iOS first boot fails)**
Dropping the file into `ios/` is not enough — it must be added to the app target in Xcode. Right-click the project → "Add Files to [YourProject]…" → select `release_config.json` → check "Copy items if needed" and ensure the target is selected. See [Bundling the release config](/docs/react-native-sdk/integration/bundling-release-config).

**App boots from the in-binary bundle on iOS even with network**
Confirm `startApp(indexBundleURL:)` is starting React Native from the provided URL and that `ReactNativeDelegate.bundleURL()` returns `customPath`. If a `#if DEBUG` branch points the bundle URL at the Metro dev server, release verification should be done on a release build.

## Next

Browse the references: [JavaScript API](/docs/react-native-sdk/reference/javascript-api) and [Callbacks & Events](/docs/react-native-sdk/reference/callbacks-and-events). To ship an update, see [Create & target a release](/docs/guides/create-and-target-a-release).

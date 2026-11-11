---
title: iOS Native API
description: The iOS initializer and delegate protocol integrators use to wire Airborne into a React Native or Expo app — the Airborne initializer and the AirborneDelegate protocol.
---

This reference documents the iOS native API that integrators interact with when wiring Airborne into a React Native or Expo app. You create an `Airborne` instance in your `AppDelegate` and implement `AirborneDelegate` to provide your namespace and dimensions and to receive the bundle URL and events. For the step-by-step wiring, see [iOS setup (React Native)](/docs/react-native-sdk/integration/ios-setup) or [iOS setup (Expo)](/docs/react-native-sdk/expo/ios-setup).

:::note[Naming]
The type you construct is exposed to Swift as `Airborne` (imported via `#import <AirborneReact/Airborne.h>`), backed by the underlying `AirborneServices` class in the Airborne framework. The initializer and delegate signatures below are what you use from Swift.
:::

## Airborne

The entry point. Construct one instance in `AppDelegate`, passing your release config URL and a delegate. Construction starts the OTA load immediately; the delegate's `startApp(indexBundleURL:)` is called when the bundle is ready.

```swift
init(releaseConfigURL: String, delegate: AirborneDelegate? = nil)
```

### Initializer

| Parameter | Type | Description |
| --- | --- | --- |
| `releaseConfigURL` | `String` | The release URL the SDK fetches the release config from, e.g. `https://airborne.juspay.in/release/<organisation>/<application>`. |
| `delegate` | `AirborneDelegate?` | The delegate that provides configuration and receives callbacks. Optional; defaults to `nil`, in which case the delegate defaults apply. |

### Public methods

| Method | Signature | Description |
| --- | --- | --- |
| `getBundlePath` | `func getBundlePath() -> String` | Returns the `file://` URL string of the current index bundle (the OTA-updated version, or the bundled fallback). Exposed through the `Airborne.h` bridge. With `bootGuardEnabled()`, the first call per process records a boot attempt, so call it only to load the bundle. |
| `getFileContent` | `func getFileContent(_ filePath: String) -> String` | Reads the content of the file at `filePath` (relative to the package) and returns it as a string. An absolute path or one with a `..` component is not read. |
| `markBootSuccess` | `func markBootSuccess()` | Boot guard: acknowledges that the JS loaded from `getIndexBundlePath()` booted healthily. Call it once the first screen has rendered. No-op when the guard is off. The JS `markBootSuccess(namespace)` does the same through the bridge. |
| `getReleaseConfig` | `func getReleaseConfig() -> String` | Returns the current release config as a stringified JSON. |

## AirborneDelegate

The protocol you conform to (typically in an `AppDelegate` extension) to customize behavior and receive callbacks. **All methods are optional** — sensible defaults apply when a method is not implemented.

```swift
@objc public protocol AirborneDelegate {
    @objc optional func namespace() -> String
    @objc optional func bundle() -> Bundle
    @objc optional func indexBundleName() -> String
    @objc optional func dimensions() -> [String: String]
    @objc optional func startApp(indexBundleURL: URL?) -> Void
    @objc optional func onEvent(level: String, label: String, key: String, value: [String: Any], category: String, subcategory: String) -> Void
    @objc optional func onLazyPackageDownloadComplete(downloadSuccess: Bool, url: String, filePath: String) -> Void
    @objc optional func onAllLazyPackageDownloadsComplete() -> Void
    @objc optional func bootGuardEnabled() -> Bool
}
```

### Methods

| Method | Signature | Description |
| --- | --- | --- |
| `namespace` | `func namespace() -> String` | Returns the namespace that isolates this app instance's downloads. Must match the namespace segment of your release URL. Defaults to `"juspay"`. |
| `bundle` | `func bundle() -> Bundle` | Returns the bundle used for local assets and fallback files (default release config and index bundle). Defaults to `Bundle.main`. |
| `indexBundleName` | `func indexBundleName() -> String` | Returns the resource name of the index bundle file used as the fallback entry point. Defaults to `"main.jsbundle"`. |
| `dimensions` | `func dimensions() -> [String: String]` | Returns custom dimensions sent as HTTP headers with the release config request, for targeting / A-B testing / segmentation. Defaults to an empty dictionary. |
| `startApp` | `func startApp(indexBundleURL: URL?)` | Called when the OTA boot completes successfully. `indexBundleURL` is the file URL of the index bundle to boot from. Start React Native here. Invoked on a background queue — dispatch UI work to the main queue. Boot completion occurs even if some downloads failed or timed out. |
| `onEvent` | `func onEvent(level: String, label: String, key: String, value: [String: Any], category: String, subcategory: String)` | Receives lifecycle and error events. See the [callbacks & events reference](/docs/react-native-sdk/reference/callbacks-and-events) for the full catalogue. |
| `onLazyPackageDownloadComplete` | `func onLazyPackageDownloadComplete(downloadSuccess: Bool, url: String, filePath: String)` | Called when an individual lazy package download completes (success or failure). |
| `bootGuardEnabled` | `func bootGuardEnabled() -> Bool` | Opts in to the [boot guard](/docs/react-native-sdk/reference/javascript-api#boot-guard). Defaults to `false`. Read once, when the application manager for the namespace is created. |
| `onAllLazyPackageDownloadsComplete` | `func onAllLazyPackageDownloadsComplete()` | Called when all lazy package downloads have completed. Use `onLazyPackageDownloadComplete` for individual results. |

#### startApp parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `indexBundleURL` | `URL?` | The file URL of the index bundle to use as the React Native entry point. |

#### onEvent parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `level` | `String` | Severity level, e.g. `"info"`, `"error"`, `"warning"`. |
| `label` | `String` | Category label for the event, e.g. `"ota_update"`. |
| `key` | `String` | The specific event identifier. |
| `value` | `[String: Any]` | Structured payload for the event. |
| `category` | `String` | The broad category, e.g. `"lifecycle"`. |
| `subcategory` | `String` | The subcategory, e.g. `"hyperota"`. |

#### onLazyPackageDownloadComplete parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `downloadSuccess` | `Bool` | Whether the lazy package download succeeded. |
| `url` | `String` | The URL of the lazy package that was downloaded. |
| `filePath` | `String` | The file path where the package was stored. |

## See also

- [JavaScript API](/docs/react-native-sdk/reference/javascript-api) — the JS helpers for reading downloaded content.
- [Android API](/docs/react-native-sdk/reference/android-api) — the Android equivalent.
- [Callbacks & events](/docs/react-native-sdk/reference/callbacks-and-events) — the full event catalogue delivered to `onEvent`.

## Opt-in boot guard

Implement `bootGuardEnabled() -> Bool` on `AirborneDelegate` and return `true`.
`AirborneServices` forwards this setting before the manager starts. React Native
calls `markBootSuccess(namespace)` after rendering; direct Swift callers use
`AirborneServices.markBootSuccess()`. Direct `AJPApplicationManager` users implement
the same optional delegate setting and call `prepareBoot()` immediately before
executing the selected JS, then `markBootSuccess()` after rendering.

Both RN architectures expose the new namespace-aware promise API. This codegen
spec change requires a native rebuild and `pod install`; an OTA-only SDK upgrade
cannot install it. For this unpublished fork, override the `Airborne` pod with a
local `:path` to `airborne_sdk_iOS/hyper-ota` so the RN bridge
links these modified Swift sources rather than released pod 0.36.4. The local source podspec matches the existing RN version constraint and must not
be published as that version. the RN tarball alone does not ship the
separate native SDK checkout.

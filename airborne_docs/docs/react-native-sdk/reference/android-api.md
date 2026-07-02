---
title: Android Native API
description: The Android classes and callbacks integrators use to wire Airborne into a React Native or Expo app — Airborne, AirborneInterface, and the React Native host and activity delegates.
---

This reference documents the Android native API that integrators interact with when wiring Airborne into a React Native or Expo app. All classes live in the `in.juspay.airborneplugin` package and are provided by `airborne-react-native`. For the step-by-step wiring, see [Android setup (React Native)](/react-native-sdk/integration/android-setup) or [Android setup (Expo)](/react-native-sdk/expo/android-setup).

## Airborne

The entry point. You construct one instance in `MainApplication`, passing your application context, your release config URL, and an `AirborneInterface` implementation. Construction starts the OTA load immediately.

```kotlin
class Airborne(
    context: Context,
    releaseConfigUrl: String,
    private val airborneInterface: AirborneInterface
)
```

### Constructor

| Parameter | Type | Description |
| --- | --- | --- |
| `context` | `Context` | The application context (use `applicationContext`). |
| `releaseConfigUrl` | `String` | The release URL the SDK fetches the release config from, e.g. `https://airborne.juspay.in/release/<organisation>/<application>`. |
| `airborneInterface` | `AirborneInterface` | The callbacks implementation. A secondary constructor `Airborne(context, releaseConfigUrl)` uses a default no-op `AirborneInterface`. |

### Public methods

| Method | Signature | Description |
| --- | --- | --- |
| `getBundlePath` | `fun getBundlePath(): String` | Returns the path of the index JS bundle. Falls back to the bundled asset path (`assets://...`, defaulting to `index.android.bundle`) when no downloaded bundle exists. Used by the React Native host's `getJSBundleFile()`. |
| `getFileContent` | `fun getFileContent(filePath: String): String` | Reads the content of the file at `filePath` (relative to the package) and returns it as a string. |
| `getReleaseConfig` | `fun getReleaseConfig(): String` | Returns the current release config as a stringified JSON. |
| `setSslConfig` | `fun setSslConfig(sslSocketFactory: SSLSocketFactory, trustManager: X509TrustManager)` | Sets a custom SSL configuration for mTLS. Call before any network requests are made to enable client-certificate authentication. |

## AirborneInterface

An abstract class you subclass (typically as an anonymous object) to provide your namespace and dimensions and to receive callbacks. Every method has a default implementation, so override only what you need.

```kotlin
abstract class AirborneInterface {
    open fun getNamespace(): String
    open fun getDimensions(): HashMap<String, String>
    open fun startApp(indexPath: String)
    open fun onEvent(level: String, label: String, key: String, value: JSONObject, category: String, subCategory: String)
    open fun getLazyDownloadCallback(): LazyDownloadCallback
}
```

### Callbacks

| Method | Signature | Description |
| --- | --- | --- |
| `getNamespace` | `fun getNamespace(): String` | Returns the application namespace. Must match the namespace segment of your release URL; the SDK uses it to identify and store the correct bundle. Defaults to `"airborne-example"`. |
| `getDimensions` | `fun getDimensions(): HashMap<String, String>` | Returns custom dimensions sent with the release config request (the `x-dimension` header) for targeting — e.g. app version or user segment. Defaults to an empty map. |
| `startApp` | `fun startApp(indexPath: String)` | Called when the boot completes and the bundle is ready. `indexPath` is the path to the index bundle to boot from. Store it and trigger your boot-complete logic. |
| `onEvent` | `fun onEvent(level: String, label: String, key: String, value: JSONObject, category: String, subCategory: String)` | Receives lifecycle and error events for logging/analytics. See the [callbacks & events reference](/react-native-sdk/reference/callbacks-and-events) for the full catalogue and field meanings. |
| `getLazyDownloadCallback` | `fun getLazyDownloadCallback(): LazyDownloadCallback` | Returns a `LazyDownloadCallback` (`in.juspay.airborne`) notified as lazy files install. Defaults to a no-op implementation that logs install status. |

#### onEvent parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `level` | `String` | Severity level, e.g. `"info"`, `"error"`. |
| `label` | `String` | Category label for the event, e.g. `"ota_update"`. |
| `key` | `String` | The specific event identifier, e.g. `"package_update_result"`. |
| `value` | `JSONObject` | Structured payload for the event. |
| `category` | `String` | The broad category, e.g. `"lifecycle"`. |
| `subCategory` | `String` | The subcategory, e.g. `"hyperota"`. |

#### LazyDownloadCallback

| Method | Signature | Description |
| --- | --- | --- |
| `fileInstalled` | `fun fileInstalled(filePath: String, success: Boolean)` | Called when an individual lazy file finishes installing, with whether it succeeded. |
| `lazySplitsInstalled` | `fun lazySplitsInstalled(success: Boolean)` | Called when all lazy splits have finished installing. |

## AirborneReactActivityDelegate

A `DefaultReactActivityDelegate` that defers `loadApp` until Airborne has resolved the JS bundle file, then loads the React app. Return it from `createReactActivityDelegate()` in `MainActivity` (wrapped in Expo's `ReactActivityDelegateWrapper` on the Expo track).

```kotlin
class AirborneReactActivityDelegate(
    activity: ReactActivity,
    mainComponentName: String,
    fabricEnabled: Boolean
) : DefaultReactActivityDelegate(activity, mainComponentName, fabricEnabled)
```

| Parameter | Type | Description |
| --- | --- | --- |
| `activity` | `ReactActivity` | The hosting React activity (`this`). |
| `mainComponentName` | `String` | The main component name. |
| `fabricEnabled` | `Boolean` | Whether Fabric (the New Architecture renderer) is enabled. |

## AirborneReactNativeHost

The React Native host that loads the bundle from Airborne's managed path. Subclass it (as an anonymous object) for your `reactNativeHost`, overriding `getJSBundleFile()` to return `airborneInstance.getBundlePath()`. It extends `AirborneReactNativeHostBase`, which itself extends `DefaultReactNativeHost`.

```kotlin
abstract class AirborneReactNativeHost(application: Application) : AirborneReactNativeHostBase(application)
```

Overrides you typically provide:

| Override | Description |
| --- | --- |
| `getJSBundleFile(): String?` | Return `airborneInstance.getBundlePath()` so React Native boots from the Airborne-managed bundle. |
| `getJSMainModuleName(): String` | `index` on plain React Native; `.expo/.virtual-metro-entry` on Expo. |
| `getPackages(): List<ReactPackage>` | The autolinked package list. |
| `getUseDeveloperSupport(): Boolean` | Usually `BuildConfig.DEBUG`. |
| `isNewArchEnabled: Boolean` | `BuildConfig.IS_NEW_ARCHITECTURE_ENABLED`. |

### AirborneReactNativeHostBase

| Member | Signature | Description |
| --- | --- | --- |
| `getReactHost` | `companion fun getReactHost(context: Context, reactNativeHost: ReactNativeHost): ReactHost` | Builds a `ReactHost` wired to Airborne's host delegate. On the plain React Native track, return it from the `reactHost` property. |

## See also

- [JavaScript API](/react-native-sdk/reference/javascript-api) — the JS helpers for reading downloaded content.
- [iOS API](/react-native-sdk/reference/ios-api) — the iOS equivalent.
- [Callbacks & events](/react-native-sdk/reference/callbacks-and-events) — the full event catalogue delivered to `onEvent`.

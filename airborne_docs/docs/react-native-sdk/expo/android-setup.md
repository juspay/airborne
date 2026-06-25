---
title: Android Setup (Expo)
description: Wire the Airborne SDK into an Expo Android app using Expo's ReactActivityDelegateWrapper and ReactNativeHostWrapper.
---

This page wires Airborne into the Android side of an Expo app. The Airborne classes are the same ones used in the [plain React Native track](/docs/react-native-sdk/integration/android-setup); the difference is that they are wrapped in Expo's `ReactActivityDelegateWrapper` and `ReactNativeHostWrapper` so Expo's lifecycle hooks keep running, and the JS main module name points at Expo's virtual metro entry.

:::note[Prerequisites]
Make sure you have installed `airborne-react-native` and run `npx expo prebuild` so the `android/` project exists before proceeding. See [Getting started](/docs/react-native-sdk/expo/getting-started).
:::

## Step 1: Add the Maven repository

Add the Airborne Maven repository to your project's `build.gradle` (or `settings.gradle` if you use the newer Gradle settings plugin):

```groovy
maven { url "https://maven.juspay.in/jp-build-packages/hyper-sdk/" }
```

## Step 2: Update MainActivity

In `MainActivity.kt`, import `AirborneReactActivityDelegate` and update `createReactActivityDelegate`. The Airborne delegate handles the React Native activity lifecycle with Airborne's bundle management, wrapped in Expo's `ReactActivityDelegateWrapper`.

```kotlin
import `in`.juspay.airborneplugin.AirborneReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return ReactActivityDelegateWrapper(
            this,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            AirborneReactActivityDelegate(
                this,
                mainComponentName,
                fabricEnabled
            )
        )
    }
}
```

## Step 3: Add imports in MainApplication

Add the Airborne imports to `MainApplication.kt`. These provide the classes needed for initialization and configuration.

```kotlin
import android.util.Log
import `in`.juspay.airborneplugin.Airborne
import `in`.juspay.airborneplugin.AirborneInterface
import `in`.juspay.airborneplugin.AirborneReactNativeHost
import `in`.juspay.airborneplugin.AirborneReactNativeHostBase
import org.json.JSONObject
```

## Step 4: Add class variables

Add the following variables inside your `MainApplication` class:

- `bundlePath` — the path to the JS bundle provided by Airborne.
- `isBootComplete` — whether Airborne has finished loading the bundle.
- `bootCompleteListener` — a callback invoked when boot completes.
- `airborneInstance` — the Airborne SDK instance.

```kotlin
class MainApplication : Application(), ReactApplication {

    private var bundlePath: String? = null
    var isBootComplete = false
    var bootCompleteListener: (() -> Unit)? = null
    private lateinit var airborneInstance: Airborne

    // ... rest of the class
}
```

## Step 5: Update ReactNativeHost

Replace the default `ReactNativeHost` with `AirborneReactNativeHost` wrapped in Expo's `ReactNativeHostWrapper`. This custom host:

- Loads the JS bundle from Airborne's managed path via `getJSBundleFile()`.
- Uses Expo's virtual metro entry as the main module (`getJSMainModuleName()` returns `.expo/.virtual-metro-entry`).
- Supports both the old and the new React Native architecture.

```kotlin
override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
    this,
    object : AirborneReactNativeHost(this@MainApplication) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
                // Packages that cannot be autolinked yet can be added manually here
            }

        override fun getJSBundleFile(): String? {
            // Get bundle path from Airborne
            return airborneInstance.getBundlePath()
        }

        override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
    }
)
```

:::tip[getJSMainModuleName]
The `.expo/.virtual-metro-entry` value is what makes this differ from a plain React Native app (which uses `index`). Expo's metro config resolves the JS entry through this virtual module — using `index` here will break Expo's bundling.
:::

## Step 6: Create the initializeAirborne function

Add an `initializeAirborne()` function inside `MainApplication`. It creates an `Airborne` instance with your release URL and implements `AirborneInterface`:

- `getNamespace()` — returns the application namespace used by Airborne. It must match the namespace segment of your release URL and identifies which bundle to fetch.
- `getDimensions()` — returns custom dimensions for targeting (for example, app version or user segment).
- `onEvent()` — receives SDK events for logging and analytics.
- `startApp()` — called when the bundle is ready; sets the bundle path and triggers boot completion.

Replace `<organisation-name>` and `<application/namespace-name>` with your actual values.

```kotlin
private fun initializeAirborne() {
    try {
        airborneInstance = Airborne(
            this.applicationContext,
            "https://airborne.juspay.in/release/<organisation-name>/<application/namespace-name>",
            object : AirborneInterface() {

                override fun getNamespace(): String {
                    return "<application/namespace-name>"
                }

                override fun getDimensions(): HashMap<String, String> {
                    val map = HashMap<String, String>()
                    // Add custom dimensions for targeting, e.g.:
                    // map["app_version"] = BuildConfig.VERSION_NAME
                    // map["user_segment"] = "premium"
                    return map
                }

                override fun onEvent(
                    level: String,
                    label: String,
                    key: String,
                    value: JSONObject,
                    category: String,
                    subCategory: String
                ) {
                    // Log the event for debugging or analytics
                    Log.d("Airborne", "Event: $label - $key")
                }

                override fun startApp(indexPath: String) {
                    isBootComplete = true
                    bundlePath = indexPath
                    bootCompleteListener?.invoke()
                }
            })
        Log.i("Airborne", "Airborne initialized successfully")
    } catch (e: Exception) {
        Log.e("Airborne", "Failed to initialize Airborne", e)
    }
}
```

See the [Android API reference](/docs/react-native-sdk/reference/android-api) for the full `AirborneInterface` surface and the [callbacks & events reference](/docs/react-native-sdk/reference/callbacks-and-events) for the events delivered to `onEvent`.

## Step 7: Update onCreate

Initialize Airborne before loading React Native so it is ready to provide the bundle path when React Native starts. With the New Architecture, set the release level first, then call `initializeAirborne()` and `loadReactNative(this)`.

```kotlin
override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
        ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
        ReleaseLevel.STABLE
    }
    initializeAirborne()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
}
```

## Next steps

- [Bundle the release config](/docs/react-native-sdk/expo/bundling-release-config) for the first-boot / offline fallback.
- Continue to [iOS setup](/docs/react-native-sdk/expo/ios-setup).

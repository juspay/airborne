---
title: Android Setup
description: Wire up MainActivity and MainApplication so Airborne boots before React Native and serves the OTA bundle on Android.
---

This page covers the full Android integration for a plain React Native app: updating `MainActivity`, then `MainApplication` with the Airborne imports, class variables, host, react host, initializer, and `onCreate`.

:::note[Prerequisites]
Make sure you have completed [Install the SDK](/docs/react-native-sdk/integration/install) — including adding the Airborne Maven repository — before proceeding.
:::

## Step 1: Update MainActivity

In your `MainActivity.kt`, import `AirborneReactActivityDelegate` and return it from `createReactActivityDelegate`. This delegate handles the React Native activity lifecycle with Airborne's bundle management.

```kotlin
// Update MainActivity.kt

import `in`.juspay.airborneplugin.AirborneReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "YourAppName"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        AirborneReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
```

Replace `YourAppName` with the component name your app registers from JavaScript.

## Step 2: Add imports in MainApplication

Add the required Airborne imports to your `MainApplication.kt`. These provide access to the SDK classes used for initialization and configuration.

```kotlin
// Add these imports in MainApplication.kt

import android.util.Log
import `in`.juspay.airborneplugin.Airborne
import `in`.juspay.airborneplugin.AirborneInterface
import `in`.juspay.airborneplugin.AirborneReactNativeHost
import `in`.juspay.airborneplugin.AirborneReactNativeHostBase
import org.json.JSONObject
```

## Step 3: Add class variables

Create the following variables inside your `MainApplication` class:

- `bundlePath` — stores the path to the JS bundle provided by Airborne.
- `isBootComplete` — tracks whether Airborne has finished loading the bundle.
- `bootCompleteListener` — callback triggered when boot is complete.
- `airborneInstance` — reference to the Airborne SDK instance.

```kotlin
// Add these variables inside MainApplication class

class MainApplication : Application(), ReactApplication {

    private var bundlePath: String? = null
    var isBootComplete = false
    var bootCompleteListener: (() -> Unit)? = null
    private lateinit var airborneInstance: Airborne

    // ... rest of the class
}
```

## Step 4: Update ReactNativeHost

Replace the default `ReactNativeHost` with `AirborneReactNativeHost`. This custom host integrates with Airborne to:

- Load the JS bundle from Airborne's managed path via `getJSBundleFile()`.
- Support both the old and new React Native architecture.

```kotlin
// Update ReactNativeHost in MainApplication

override val reactNativeHost: ReactNativeHost =
    object : AirborneReactNativeHost(this@MainApplication) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
                // Packages that cannot be autolinked yet can be added manually here
            }

        override fun getJSBundleFile(): String? {
            // This is delayed until mainActivity is created.
            // Make sure react is not booted until after bundlePath is created
            return airborneInstance.getBundlePath()
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }
```

`getJSBundleFile()` returns `airborneInstance.getBundlePath()`, which resolves only once Airborne has a bundle ready — this is how the SDK blocks React Native from booting until the OTA bundle is available.

## Step 5: Update ReactHost

Update the `reactHost` property to use Airborne's implementation. This ensures proper initialization with Airborne's bundle management.

```kotlin
// Update ReactHost in MainApplication

override val reactHost: ReactHost
    get() = AirborneReactNativeHostBase.getReactHost(applicationContext, reactNativeHost)
```

## Step 6: Create initializeAirborne()

Create an `initializeAirborne()` function inside your `MainApplication` class. It:

1. Creates an `Airborne` instance with your release config URL.
2. Implements `AirborneInterface` with the required callbacks:
   - `getNamespace()` — returns the application namespace used by Airborne. This must match the namespace segment in the release URL and is used to identify and fetch the correct bundle.
   - `getDimensions()` — returns custom dimensions for targeting (for example app version or user segment).
   - `onEvent()` — receives SDK events for logging or analytics.
   - `startApp()` — called when the bundle is ready; sets the bundle path and triggers boot complete.

Replace `<organisation-name>` and `<application/namespace-name>` with your actual values.

```kotlin
// Create initializeAirborne function in MainApplication

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

## Step 7: Initialize in onCreate

Call `initializeAirborne()` in `onCreate()` **before** loading React Native, so Airborne is ready to provide the bundle path when React Native starts.

```kotlin
// Update onCreate in MainApplication

override fun onCreate() {
    super.onCreate()
    initializeAirborne()
    loadReactNative(this)
}
```

:::caution[Namespace must match]
The string returned by `getNamespace()` must match the `<application/namespace-name>` segment of your release URL **and** the folder used for the bundled release config. A mismatch means the SDK cannot find the right bundle. See [Bundling the release config](/docs/react-native-sdk/integration/bundling-release-config).
:::

## Next

Continue with **[iOS setup](/docs/react-native-sdk/integration/ios-setup)**, or jump to [Bundling the release config](/docs/react-native-sdk/integration/bundling-release-config).

---
title: React Native (bare)
description: Integrate the native Airborne SDKs directly into a plain React Native app — add the Gradle/CocoaPods dependencies and boot React Native from the OTA bundle in MainApplication and AppDelegate.
---

This page covers the full **bare** integration for a plain React Native app: adding the native Airborne dependency, then writing the boot code that initializes Airborne, resolves the OTA bundle, and hands it to React Native. There is **no `airborne-react-native` npm package** in this flow — you talk to the native SDK directly.

:::caution[This is the advanced flow]
For most apps the [React Native SDK](/docs/react-native-sdk/integration/getting-started) is simpler. Read the [Bare Airborne overview](/docs/bare-integration/overview) first to decide whether you need this.
:::

:::note[Prerequisites]
- A working plain React Native app (New Architecture). If you use Expo, follow [Expo (bare)](/docs/bare-integration/expo) instead.
- A namespace/application created on the Airborne dashboard and a release URL of the form `https://airborne.juspay.in/release/<organisation>/<application/namespace-name>`.
- A **bundled `release_config.json`** and JS bundle shipped in the app binary for the first-run / offline fallback, exactly as for the plugin flow — see [Bundling the release config](/docs/react-native-sdk/integration/bundling-release-config).
:::

Throughout, replace `<organisation>`, `<application/namespace-name>`, and `YourAppName` (your registered module name) with your own values.

## Android

### Step 1: Add the Maven repository

The native Android SDK is distributed from the Hyper SDK Maven repository. Add it under `allprojects { repositories { ... } }` in `android/build.gradle`:

```groovy
allprojects {
    repositories {
        maven { url "https://maven.juspay.in/jp-build-packages/hyper-sdk/" }
    }
}
```

If your project uses the newer Gradle settings model, add it to `android/settings.gradle` under `dependencyResolutionManagement { repositories { ... } }` instead.

:::caution
Declare the repository in exactly one place. If `dependencyResolutionManagement` uses `RepositoriesMode.FAIL_ON_PROJECT_REPOS`, adding repositories in `build.gradle` will fail the build — put the Maven URL in `settings.gradle`.
:::

### Step 2: Add the dependency

In `android/app/build.gradle`, add the native Airborne SDK:

```groovy
dependencies {
    implementation("in.juspay:airborne:2.2.8-rc.25")
}
```

This pulls in the native OTA engine (and its `in.juspay:hyperutil` transitive dependency) from the Maven repository above. You do **not** add `airborne-react-native`.

### Step 3: Boot React Native from the OTA bundle

In the bare flow you build the `ReactHost` yourself and give it the bundle path Airborne resolved. The key pieces in `MainApplication.kt`:

- Create `HyperOTAServices` with your namespace, release URL, a `TrackerCallback`, and the `onBootComplete` / `onPackageDownloaded` callbacks.
- Call `createApplicationManager(...)` then `loadApplication(...)` to start the update.
- In `reactHost`, resolve the bundle path with `appManager.getIndexBundlePath()` — this **blocks until Airborne has a bundle ready**, which is how boot waits for the OTA copy. Fall back to the APK's bundled asset when nothing is staged yet.

```kotlin
package com.yourapp

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import `in`.juspay.airborne.HyperOTAServices
import `in`.juspay.airborne.TrackerCallback
import `in`.juspay.airborne.ota.ApplicationManager
import org.json.JSONObject

private const val TAG = "Airborne"
private const val NAMESPACE = "<application/namespace-name>"
private const val RELEASE_CONFIG_URL =
    "https://airborne.juspay.in/release/<organisation>/<application/namespace-name>"

class MainApplication : Application(), ReactApplication {

    private lateinit var appManager: ApplicationManager

    override val reactHost: ReactHost by lazy {
        val bundlePath = resolveBundlePath()
        Log.i(TAG, "handing bundle to React Native: $bundlePath")
        getDefaultReactHost(
            context = applicationContext,
            packageList = PackageList(this).packages,
            jsBundleFilePath = bundlePath,
            useDevSupport = false,
        )
    }

    override fun onCreate() {
        super.onCreate()
        startAirborne()
        loadReactNative(this)
    }

    private fun startAirborne() {
        val tracker = object : TrackerCallback() {
            override fun track(
                category: String, subCategory: String, level: String,
                label: String, key: String, value: JSONObject,
            ) {
                Log.d(TAG, "track [$level] $label | $key | $value")
            }

            override fun trackException(
                category: String, subCategory: String,
                label: String, description: String, e: Throwable,
            ) {
                Log.e(TAG, "trackException $label | $description", e)
            }
        }

        val services = HyperOTAServices(
            applicationContext,
            NAMESPACE,
            "",                       // appVersion — optional, used for targeting
            RELEASE_CONFIG_URL,
            tracker,
            onBootComplete = { indexPath -> Log.i(TAG, "bootComplete indexPath='$indexPath'") },
            // Raised when a package finishes downloading after the boot timeout (staged, not yet
            // applied). See "Reload after a post-timeout update" to turn this into a reload prompt.
            onPackageDownloaded = { old, new -> Log.i(TAG, "onPackageDownloaded old=$old new=$new") },
        )

        appManager = services.createApplicationManager(hashMapOf())
        appManager.loadApplication(NAMESPACE, null)
    }

    private fun resolveBundlePath(): String {
        // Blocks until Airborne has resolved a bundle. Returns the staged OTA bundle if present…
        val staged = appManager.getIndexBundlePath()
        if (staged.isNotEmpty()) {
            Log.i(TAG, "booting from OTA bundle on disk")
            return staged
        }
        // …otherwise fall back to the bundle shipped in the APK.
        val bundled = appManager.getBundledIndexPath().ifEmpty { "index.android.bundle" }
        Log.i(TAG, "no OTA bundle staged, booting from APK assets")
        return "assets://$bundled"
    }
}
```

:::caution[Namespace must match]
The `NAMESPACE` you pass to `HyperOTAServices` and `loadApplication` must match the `<application/namespace-name>` segment of your release URL **and** the folder holding your bundled `release_config.json`. A mismatch means the SDK cannot find the right bundle.
:::

`MainActivity` needs **no Airborne-specific changes** — a standard `ReactActivity` with `DefaultReactActivityDelegate` is fine, because the bundle path is supplied through the `ReactHost` above, not through the activity delegate.

## iOS

### Step 4: Add the pod

Add the native `Airborne` pod to your `ios/Podfile` target:

```ruby
target 'YourAppName' do
  # …existing React Native config…

  pod 'Airborne', '0.42.0'
end
```

Then install:

```bash
cd ios && pod install
```

:::note[Native pod, not AirborneReact]
The bare flow uses the native **`Airborne`** pod. This is different from the `AirborneReact` pod the plugin auto-links — do not add both.
:::

### Step 5: Boot React Native from the OTA bundle

In `AppDelegate.swift`, initialize `AirborneServices` early (it starts fetching immediately), conform to `AirborneDelegate`, and start React Native from the `startApp(indexBundleURL:)` callback — once Airborne hands you the resolved bundle. React Native is **not** started in `didFinishLaunchingWithOptions`.

```swift
import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Airborne

private let NAMESPACE = "<application/namespace-name>"
private let RELEASE_CONFIG_URL =
    "https://airborne.juspay.in/release/<organisation>/<application/namespace-name>"

@main
class AppDelegate: UIResponder, UIApplicationDelegate, AirborneDelegate {

    var window: UIWindow?
    var reactNativeDelegate: ReactNativeDelegate?
    var reactNativeFactory: RCTReactNativeFactory?

    private var airborne: AirborneServices?
    private var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    private var reactStarted = false

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        self.launchOptions = launchOptions
        window = UIWindow(frame: UIScreen.main.bounds)

        // Airborne resolves the bundle (installing any package staged by a previous run) before RN
        // boots. startApp(indexBundleURL:) fires once boot completes or the boot timeout elapses.
        airborne = AirborneServices(releaseConfigURL: RELEASE_CONFIG_URL, delegate: self)
        return true
    }

    // MARK: - AirborneDelegate

    func namespace() -> String { NAMESPACE }

    func indexBundleName() -> String { "main.jsbundle" }

    func dimensions() -> [String: String] { [:] }

    func startApp(indexBundleURL: URL?) {
        DispatchQueue.main.async { [weak self] in
            self?.bootReactNative(bundleURL: indexBundleURL)
        }
    }

    func onEvent(
        level: String, label: String, key: String,
        value: [String: Any], category: String, subcategory: String
    ) {
        NSLog("[Airborne] [%@] %@ | %@", level, label, key)
    }

    // Raised when a package finishes downloading after the boot timeout (staged, not yet applied).
    // See "Reload after a post-timeout update" to turn this into a reload prompt.
    func onPackageDownloaded(oldVersion: String, newVersion: String) {
        NSLog("[Airborne] onPackageDownloaded old=%@ new=%@", oldVersion, newVersion)
    }

    // MARK: - React Native boot

    private func bootReactNative(bundleURL: URL?) {
        guard !reactStarted else {
            // Already running: a staged package was installed, so swap the bundle and reload JS.
            reactNativeDelegate?.airborneBundleURL = bundleURL
            RCTTriggerReloadCommandListeners("Airborne OTA update applied")
            return
        }
        reactStarted = true

        let delegate = ReactNativeDelegate()
        delegate.airborneBundleURL = bundleURL
        delegate.dependencyProvider = RCTAppDependencyProvider()
        let factory = RCTReactNativeFactory(delegate: delegate)

        reactNativeDelegate = delegate
        reactNativeFactory = factory

        factory.startReactNative(
            withModuleName: "YourAppName",
            in: window,
            launchOptions: launchOptions
        )
    }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
    var airborneBundleURL: URL?

    override func sourceURL(for bridge: RCTBridge) -> URL? {
        self.bundleURL()
    }

    override func bundleURL() -> URL? {
        // Always the path Airborne resolved — never Metro, never a hardcoded main.jsbundle.
        airborneBundleURL ?? Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    }
}
```

The `reactStarted` guard in `bootReactNative` means a **second** `startApp` call (which happens when you re-initialize Airborne to apply a staged update) reloads JS onto the new bundle instead of starting a second React Native instance. That path is used by [Reload after a post-timeout update](/docs/bare-integration/reload-after-download).

:::caution[Namespace must match]
`namespace()` must match the `<application/namespace-name>` segment of your release URL and your bundled config location.
:::

## Verify

1. Ship a build with a bundled `release_config.json` and note the marker text visible on screen.
2. From the dashboard, create a package with a changed marker and [create a release](/docs/guides/create-and-target-a-release) targeting your app.
3. Relaunch the app. On a cold start where the download finishes within the boot timeout, the app boots straight onto the new bundle. If it finishes *after* the timeout, it is staged — watch for the `onPackageDownloaded` log, and see the next page to prompt a reload.

## Next

- **[Reload after a post-timeout update](/docs/bare-integration/reload-after-download)** — the reason to use the bare flow: turn `onPackageDownloaded` into a "Reload now" prompt.
- **[Expo (bare)](/docs/bare-integration/expo)** — if your app is built with Expo.

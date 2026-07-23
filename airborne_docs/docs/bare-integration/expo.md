---
title: Expo (bare)
description: Adapt the bare Airborne integration for an Expo app — the Airborne wiring is identical to the plain React Native flow, with Expo's app-delegate and host wrappers preserved.
---

The bare Airborne integration for **Expo** is the same as the [plain React Native flow](/docs/bare-integration/react-native): the same native dependencies (`in.juspay:airborne` `2.2.8-rc.25` on Android, the `Airborne` pod `0.42.0` on iOS), the same `HyperOTAServices` / `AirborneServices` wiring, and the same [reload-after-download](/docs/bare-integration/reload-after-download) capability. Only a handful of **Expo-specific touchpoints** differ.

:::note[Prerequisites]
- Run `npx expo prebuild` so the native `android/` and `ios/` projects exist — the bare flow edits native code directly.
- Read [React Native (bare)](/docs/bare-integration/react-native) first. This page only lists what changes for Expo; the Airborne wiring itself is unchanged.
:::

:::caution[This is the advanced flow]
For most Expo apps, the [React Native SDK Expo track](/docs/react-native-sdk/expo/getting-started) is simpler. Use the bare flow only when you need the low-level control described in the [overview](/docs/bare-integration/overview).
:::

## What is identical

Follow these steps from [React Native (bare)](/docs/bare-integration/react-native) unchanged:

- **Android** — Step 1 (add the Maven repository) and Step 2 (add the `in.juspay:airborne:2.2.8-rc.25` dependency).
- **iOS** — Step 4 (add `pod 'Airborne', '0.42.0'`, then `pod install`).
- The Airborne initialization itself: creating `HyperOTAServices` / `AirborneServices`, resolving the bundle from `getIndexBundlePath()`, and the `onPackageDownloaded` handling.

## Android — Expo touchpoints

The Airborne wiring in `MainApplication` (creating `HyperOTAServices`, `createApplicationManager`, `loadApplication`, and resolving `getIndexBundlePath()`) is exactly as in the plain React Native flow. Preserve these Expo specifics on top of it:

- **Keep Expo's lifecycle dispatch.** Call `ApplicationLifecycleDispatcher.onApplicationCreate(this)` at the end of `onCreate()`, and set the New Architecture release level, just as Expo's generated `MainApplication` does:

  ```kotlin
  override fun onCreate() {
      super.onCreate()
      DefaultNewArchitectureEntryPoint.releaseLevel = try {
          ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
      } catch (e: IllegalArgumentException) {
          ReleaseLevel.STABLE
      }
      startAirborne()                                    // your Airborne init (unchanged)
      loadReactNative(this)
      ApplicationLifecycleDispatcher.onApplicationCreate(this)  // keep Expo's dispatch
  }
  ```

- **Use Expo's JS entry.** Where the plain flow uses `index` as the JS main module, Expo resolves its entry through the virtual metro module `.expo/.virtual-metro-entry`. Keep that value wherever your host declares the JS main module name — using `index` breaks Expo's bundling.
- **Keep Expo's host / activity wrappers.** If your generated project wraps the host in `ReactNativeHostWrapper` and the activity delegate in `ReactActivityDelegateWrapper`, keep those wrappers so Expo modules keep working. The Airborne bundle path is still supplied through the resolved bundle path (`getIndexBundlePath()`) — see the wrapper mechanics in the [standard Expo Android setup](/docs/react-native-sdk/expo/android-setup).

## iOS — Expo touchpoints

Your Expo app delegate extends **`ExpoAppDelegate`**. Take the `AppDelegate` from [React Native (bare) — Step 5](/docs/bare-integration/react-native) and apply these three changes:

1. **Extend `ExpoAppDelegate`** (which already declares `reactNativeDelegate` / `reactNativeFactory`), and make `application(_:didFinishLaunchingWithOptions:)` a `public override` that calls `super`. Expo generates **three** `application` functions — update **only** `didFinishLaunchingWithOptions`; leave the URL/universal-link ones untouched.

   ```swift
   @main
   public class AppDelegate: ExpoAppDelegate, AirborneDelegate {

       var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
       private var airborne: AirborneServices?
       private var reactStarted = false

       public override func application(
           _ application: UIApplication,
           didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
       ) -> Bool {
           self.launchOptions = launchOptions
           window = UIWindow(frame: UIScreen.main.bounds)
           airborne = AirborneServices(releaseConfigURL: RELEASE_CONFIG_URL, delegate: self)
           return super.application(application, didFinishLaunchingWithOptions: launchOptions)
       }
       // …AirborneDelegate methods unchanged from the RN bare page…
   }
   ```

2. **Bind the factory and use module name `"main"`.** In `bootReactNative`, call `bindReactNativeFactory(factory)` (provided by `ExpoAppDelegate`) before starting, and pass `withModuleName: "main"` — Expo registers its root component under `main`, not your app name:

   ```swift
   let factory = RCTReactNativeFactory(delegate: delegate)
   reactNativeDelegate = delegate
   reactNativeFactory = factory
   bindReactNativeFactory(factory)                        // Expo-specific

   factory.startReactNative(
       withModuleName: "main",                            // Expo registers under "main"
       in: window,
       launchOptions: launchOptions
   )
   ```

3. **Keep the `ReactNativeDelegate`** exactly as in the plain flow — it still returns the Airborne-resolved bundle URL from `bundleURL()`.

Everything else — the `AirborneDelegate` methods, the `reactStarted` guard, and the `onPackageDownloaded` reload flow — is identical to the plain React Native flow.

## Next

- **[Reload after a post-timeout update](/docs/bare-integration/reload-after-download)** — wire `onPackageDownloaded` into a reload prompt (works the same on Expo).
- **[Create & target a release](/docs/guides/create-and-target-a-release)** — release creation is unchanged from the dashboard.

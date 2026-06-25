---
title: Integration in Expo
description: Orientation for wiring the Airborne React Native SDK into an Expo app, and how it differs from a bare React Native project.
---

This track covers integrating the Airborne React Native SDK into an **Expo** app. Airborne boots before React Native mounts, fetches the latest JavaScript bundle and assets described by your release config, and hands React Native the path to boot from — exactly as in the [plain React Native track](/react-native-sdk/integration/getting-started). The only difference is *where* the native wiring goes: Expo manages its own `ReactActivityDelegate`, `ReactNativeHost`, and `AppDelegate`, so the Airborne pieces are layered on top of Expo's wrappers rather than replacing them.

## Prerequisites

- An Expo app that uses [Expo's bare/prebuild native projects](https://docs.expo.dev/workflow/continuous-native-generation/) (the `android/` and `ios/` directories must exist — Airborne integrates at the native layer and cannot run in Expo Go).
- React Native's [New Architecture](https://reactnative.dev/architecture/landing-page) enabled (the Expo wrappers and code samples below assume it).
- A release URL of the form `https://airborne.juspay.in/release/<organisation>/<application>`, or a self-hosted release config JSON.
- The `airborne-react-native` package installed (see below).

:::info[Expo Go is not supported]
Airborne wires into the native launch sequence, so the app must be built with the native projects present (`expo prebuild` / a development or release build). It will not work under Expo Go.
:::

## How it differs from bare React Native

The Airborne classes are identical across both tracks — the Expo integration simply wraps them in Expo's own delegates so Expo's lifecycle hooks keep running:

| Concern | Plain React Native | Expo |
| --- | --- | --- |
| Activity delegate | `AirborneReactActivityDelegate` returned directly | `AirborneReactActivityDelegate` wrapped in `ReactActivityDelegateWrapper` |
| React Native host | `AirborneReactNativeHost` returned directly | `AirborneReactNativeHost` wrapped in `ReactNativeHostWrapper` |
| JS main module name | `index` | `.expo/.virtual-metro-entry` |
| App delegate base class | `UIResponder, UIApplicationDelegate` | `ExpoAppDelegate` |
| iOS launch hooks | one `application(_:didFinishLaunchingWithOptions:)` | three `application` functions — update **only** `didFinishLaunchingWithOptions` |
| React Native module name (iOS) | your app name | `"main"` |

## Installing the SDK

The SDK is published to npm as [`airborne-react-native`](https://www.npmjs.com/package/airborne-react-native). Add it to your `package.json`:

```json
{
  "dependencies": {
    "airborne-react-native": "^0.37.0"
  }
}
```

Then install and regenerate the native projects:

```bash
npm install
npx expo prebuild
```

The SDK is also available from the [GitHub repository](https://github.com/juspay/airborne).

## Integration outline

Work through these pages in order:

1. [Android setup](/react-native-sdk/expo/android-setup) — add the Maven repository, wrap `AirborneReactActivityDelegate` and `AirborneReactNativeHost` in Expo's wrappers, and initialize Airborne in `MainApplication`.
2. [iOS setup](/react-native-sdk/expo/ios-setup) — add a bridging header, initialize Airborne in your `ExpoAppDelegate`, and implement the `AirborneDelegate` extension.
3. [Bundling the release config](/react-native-sdk/expo/bundling-release-config) — ship a `release_config.json` for the first-boot / offline fallback.

## The JS API and events are identical

Once the native wiring is in place, the JavaScript surface and the SDK event stream are the **same** as the plain React Native track — there is nothing Expo-specific in JavaScript. See the references:

- [JavaScript API](/react-native-sdk/reference/javascript-api) — `readReleaseConfig`, `getBundlePath`, `getFileContent`.
- [Android API](/react-native-sdk/reference/android-api) and [iOS API](/react-native-sdk/reference/ios-api) — the native callbacks you implement.
- [Callbacks & events](/react-native-sdk/reference/callbacks-and-events) — the full SDK event catalogue delivered to `onEvent`.

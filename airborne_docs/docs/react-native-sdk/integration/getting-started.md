---
title: Integration in React Native
description: Prerequisites, how Airborne boots ahead of React Native, and the end-to-end outline for integrating the SDK into a plain React Native app.
---

This guide walks through integrating the Airborne SDK into a **plain React Native** app (not Expo — for that, see [Integration in Expo](/docs/react-native-sdk/expo/getting-started)). Because Airborne boots before React Native mounts, the integration happens mostly in your native Android and iOS code.

## Prerequisites

- A React Native app you can build for Android and iOS.
- An Airborne release URL of the form `https://airborne.juspay.in/release/<organisation>/<application>` (or a self-hosted release config URL).
- The **namespace** (application id) for your release. This must match the `<application>` segment of the release URL.
- Access to native code: `MainActivity.kt` / `MainApplication.kt` (Android) and `AppDelegate.swift` (iOS).

:::note
If you are using the [React Native CLI](/docs/react-native-cli/getting-started), it can scaffold and bundle your `release_config.json` for you. This guide covers both CLI and non-CLI setups.
:::

## How Airborne boots ahead of React Native

Normally React Native loads a JS bundle that is compiled into the app binary. With Airborne, the SDK initializes first, fetches the latest release config, downloads the package and resources, and only then hands React Native the path to the OTA bundle.

Rather than firing a "boot complete" callback that React then waits on, the SDK **blocks the bundle-loading path** until the bundle is ready:

- On **Android**, `AirborneReactNativeHost.getJSBundleFile()` returns `airborneInstance.getBundlePath()`, which resolves only once Airborne has a bundle.
- On **iOS**, the `startApp` delegate method is called with the OTA bundle URL, and React Native is started from there.

If the release config or downloads do not complete within the boot/release timeout — for example on a first launch with no network — Airborne boots from the **bundled release config** shipped in the app, then continues updating in the background.

## Integration outline

1. **[Install](/docs/react-native-sdk/integration/install)** — add `airborne-react-native` and the Airborne Maven repository.
2. **[Android setup](/docs/react-native-sdk/integration/android-setup)** — wire up `MainActivity` and `MainApplication`.
3. **[iOS setup](/docs/react-native-sdk/integration/ios-setup)** — wire up the bridging header and `AppDelegate`.
4. **[Bundle the release config](/docs/react-native-sdk/integration/bundling-release-config)** — package `release_config.json` for first-boot fallback.
5. **[Verify](/docs/react-native-sdk/integration/verify)** — confirm the SDK boots and serves the OTA bundle.

## SDK inputs

You provide these to the SDK when you initialize it natively:

- **Release Config URL** — the URL the SDK makes GET and HEAD requests to for the release config JSON. Typically `https://airborne.juspay.in/release/<organisation>/<application>`.
- **Namespace** — the scope under which the SDK saves assets. It must match the `<application>` segment of the release URL, and isolates downloads when more than one SDK instance runs in the same app.
- **Bundled release config path** — where the packaged `release_config.json` lives, used to boot when downloads do not finish within the timeout. See [Bundling the release config](/docs/react-native-sdk/integration/bundling-release-config).
- **Dimensions** — user-defined key/value pairs sent on the release config request as the `x-dimension` header, formatted as `<key1>=<value1>;<key2>=<value2>;` sorted alphabetically by key. Use them to target releases (for example by app version or user segment).

## Callbacks

The native `AirborneInterface` (Android) and `AirborneDelegate` (iOS) deliver these callbacks:

- **Boot Completion** — signals that boot is done. In React Native this is realized by the SDK blocking the bundle-loading path (`getJSBundleFile` on Android, `startApp` on iOS) rather than by a standalone callback.
- **Tracker** — a stream of SDK events (`onEvent`) you can forward to logging or analytics to monitor release health. See [Callbacks & Events](/docs/react-native-sdk/reference/callbacks-and-events).
- **Lazy Download** — informs the app that specific lazily downloaded files are now available for use.

## Next

Start with **[Install](/docs/react-native-sdk/integration/install)**.

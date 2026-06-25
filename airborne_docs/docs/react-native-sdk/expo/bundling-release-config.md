---
title: Bundling the Release Config (Expo)
description: Ship a release_config.json with your Expo app so the SDK can boot from bundled assets on first launch or when offline.
---

On the very first launch — or any launch where the device is offline — downloads may not finish within the boot/release timeout. When that happens, Airborne boots from a `release_config.json` and the assets shipped inside the app binary. Bundling this config makes the first-run and offline experience reliable; once downloads succeed, the SDK boots from the OTA copy instead.

This is the same fallback used by the [plain React Native track](/docs/react-native-sdk/integration/bundling-release-config); the placement of the file in each native project is identical.

## With the Airborne CLI (recommended)

If you use the [Airborne React Native CLI](/docs/react-native-cli/getting-started) for bundling, it generates and places `release_config.json` for you.

### iOS

The CLI writes the config into your app's main bundle automatically at `ios/release_config.json`.

:::warning[Add the file to your Xcode project]
Placing the file in the `ios/` folder does **not** automatically include it in the build. In Xcode, right-click your project folder, choose **Add Files to [YourProject]**, select `release_config.json`, and make sure **Copy items if needed** is checked and your app target is selected. The `bundle()` you return from the [`AirborneDelegate`](/docs/react-native-sdk/expo/ios-setup) (typically `Bundle.main`) must contain this file.
:::

### Android

On Android the bundled config lives inside the namespace folder of your assets, for example `android/app/src/main/assets/<namespace>/release_config.json`. The CLI places it there for you. The `<namespace>` segment must match the value returned by `getNamespace()` in your [`AirborneInterface`](/docs/react-native-sdk/expo/android-setup).

## Without the Airborne CLI

If you are not using the CLI, place the bundled config yourself.

### iOS

Put the file at `ios/release_config.json` and add it to your Xcode project (see the warning above). Ensure it ends up in the bundle returned by your `AirborneDelegate.bundle()`.

### Android

Place the file inside the namespace folder of assets. For a namespace of `example`, the path is:

```bash
android/app/src/main/assets/example/release_config.json
```

If the namespace returned by `getNamespace()` is `<application/namespace-name>`, the path is `android/app/src/main/assets/<application/namespace-name>/release_config.json`.

:::tip[Keep the namespace consistent]
The folder name on Android, the `namespace()`/`getNamespace()` returned by your delegate, and the namespace segment of your release URL (`https://airborne.juspay.in/release/<organisation>/<application>`) must all agree. A mismatch means the SDK cannot find the bundled config and will fail to boot offline.
:::

## What goes in release_config.json

`release_config.json` is the same JSON the SDK fetches from your release URL at runtime — it points at the package and resources to boot and carries the version the SDK uses to detect updates. Bundling a current copy means first launch boots immediately from local assets while the SDK fetches the latest config in the background. See the [SDK overview](/docs/react-native-sdk/overview) for how release config, packages, and resources fit together.

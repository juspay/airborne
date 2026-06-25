---
title: Bundling the Release Config
description: Package release_config.json into your iOS and Android builds so the app has a first-boot and offline fallback.
---

On the very first run — or any launch where downloads do not finish within the boot/release timeout — the SDK boots from a `release_config.json` packaged inside the app binary. This page explains where that file must live on each platform, both when using the Airborne CLI and when bundling it yourself.

:::info[Why this matters]
Without a bundled release config, the first launch (before any OTA download completes) and offline launches have nothing to boot from. The bundled config is the fallback that keeps the app reliable while Airborne fetches the latest release in the background.
:::

## With the Airborne CLI

If you use the [React Native CLI](/docs/react-native-cli/getting-started), it generates and places `release_config.json` for you.

### iOS

The CLI bundles `release_config.json` into your app's main bundle automatically at `ios/release_config.json`.

:::caution[Add the file to your Xcode project]
Placing the file in the `ios/` folder does **not** automatically include it in the build. In Xcode, right-click your project folder, choose **"Add Files to [YourProject]…"**, select `release_config.json`, ensure **"Copy items if needed"** is checked, and make sure the app target is selected. Otherwise the file will not be present in the built app and the first-boot fallback will fail.
:::

### Android

On Android the bundled config lives inside the namespace folder under assets:

```
app/src/main/assets/<namespace>/release_config.json
```

For example, if your namespace is `example`, the path is `app/src/main/assets/example/release_config.json`. The `<namespace>` segment must match the value returned by `getNamespace()` in your [Android setup](/docs/react-native-sdk/integration/android-setup).

## For non-CLI users

If you are not using the Airborne CLI, place the file yourself in the same locations.

### iOS

Place `release_config.json` at `ios/release_config.json` and add it to your Xcode project (see the Xcode caution above — the file must be added to the target, not just dropped in the folder).

### Android

Place the file inside the namespace folder of your assets:

```
app/src/main/assets/<namespace>/release_config.json
```

If the namespace is `example`, that is `app/src/main/assets/example/release_config.json`.

:::tip[Keep namespaces consistent]
The namespace appears in three places that must all agree: the `<application/namespace-name>` segment of your release URL, the value returned by `getNamespace()` / `namespace()` in native code, and the Android assets folder name. A mismatch is the most common reason the bundled config is not found.
:::

## Next

Once the config is bundled, **[verify the integration](/docs/react-native-sdk/integration/verify)**.

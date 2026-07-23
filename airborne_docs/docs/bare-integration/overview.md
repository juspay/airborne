---
title: Bare Airborne (Advanced)
description: Integrate the native Airborne OTA SDKs directly into a React Native or Expo app — without the airborne-react-native plugin — for deep control over the OTA lifecycle.
---

**Bare Airborne** wires the native Airborne OTA SDKs — `in.juspay:airborne` on Android and the `Airborne` CocoaPod on iOS — **directly** into a React Native or Expo app, **without** the [`airborne-react-native`](/docs/react-native-sdk/overview) plugin. Instead of letting the plugin manage the bundle and boot for you, you write the native boot code yourself: you decide when React Native starts, which bundle it boots from, and how the app reacts when a new package finishes downloading.

:::caution[Prefer the React Native SDK for most apps]
This is an **advanced** flow for teams that need low-level control over the OTA lifecycle. It means owning more native code (`MainApplication`/`AppDelegate`) and keeping it in sync with React Native upgrades.

For a typical app, use the **[React Native SDK](/docs/react-native-sdk/overview)** instead — it handles the native wiring for you and is far simpler to set up. Only reach for the bare flow when you have a concrete reason to.
:::

## When to use the bare flow

Choose the bare integration when you need something the plugin does not currently expose — most commonly:

- **Reacting to `onPackageDownloaded`.** The native SDKs raise this callback when a package finishes downloading *after* the boot timeout (so it is staged rather than applied on this run). The bare flow lets you catch it and, for example, show a **"Reload now"** prompt so users get the update without waiting for a natural app restart. See [Reload after a post-timeout update](/docs/bare-integration/reload-after-download).
- **Full control of the boot and reload sequence** — exactly when and how React Native starts, and how you swap the bundle and reload JS when an update is applied.

If you don't need any of this, the [React Native SDK](/docs/react-native-sdk/overview) does the same OTA delivery with much less code.

## What stays the same

The bare flow only changes the **SDK integration** in your app. Everything on the Airborne side is unchanged:

- **Release creation is identical.** You still build packages and create releases, cohorts, and dimensions from the **Airborne dashboard** exactly as with the plugin. See [Create & target a release](/docs/guides/create-and-target-a-release) and the [Releases](/docs/dashboard/releases) reference.
- **The core concepts are the same** — release config, package, namespace, resources, and the boot / release-config timeouts. See [Download & boot flow](/docs/concepts/download-and-boot-flow).

## What differs

- You add the **native Airborne SDK** as a direct dependency (Gradle on Android, CocoaPods on iOS) instead of the `airborne-react-native` npm package.
- You write the **boot integration** yourself — initialize Airborne before React Native, resolve the bundle path from the SDK, and hand it to React Native.
- You get direct access to the native callbacks, including **`onPackageDownloaded`**.

## Versions

Use these published versions of the native SDKs:

| Platform | Dependency | Version |
| --- | --- | --- |
| Android | `in.juspay:airborne` (Gradle) | `2.2.8-rc.25` |
| iOS | `Airborne` (CocoaPods) | `0.42.0` |

:::note[The Hyper SDK Maven repository is still required]
The Android SDK resolves from the Hyper SDK Maven repository **`https://maven.juspay.in/jp-build-packages/hyper-sdk/`** — the same repository the plugin uses. Keep it in your Gradle configuration (see [React Native (bare)](/docs/bare-integration/react-native)).
:::

## Next

- **[React Native (bare)](/docs/bare-integration/react-native)** — the full Android + iOS integration for a plain React Native app.
- **[Expo (bare)](/docs/bare-integration/expo)** — the same integration, adapted for Expo's app-delegate and host wrappers.
- **[Reload after a post-timeout update](/docs/bare-integration/reload-after-download)** — the `onPackageDownloaded` use case and the `boot_timeout: 0` "always prompt" configuration.

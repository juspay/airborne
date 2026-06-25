---
title: React Native SDK Overview
description: How the Airborne React Native SDK boots your app from an over-the-air bundle, the pieces involved, and the two integration tracks.
---

The Airborne React Native SDK delivers over-the-air (OTA) updates to your app's JavaScript bundle and assets. Instead of loading a static bundle compiled into the binary, your app boots from a bundle that Airborne manages — fetching the latest packages and resources described by a release config, and falling back to the assets shipped with the app when needed.

## What the SDK does

Airborne runs **before React Native mounts**. On launch it:

1. Reads a **release config** from your release URL (a GET/HEAD request to the Airborne server or a self-hosted JSON).
2. Downloads any **packages** and **resources** the config points to, scoped to a **namespace** so multiple SDK instances never collide.
3. Hands React Native the path to the resulting JS bundle so the app boots from the OTA copy.
4. Falls back to the **bundled release config and assets** shipped in the app binary if downloads do not finish within the boot/release timeout — so the first launch (or an offline launch) always has something to boot from.

This means a release can ship new JavaScript and assets to users without going through the app store, while the first-run experience stays reliable.

## The pieces

An Airborne React Native integration is made up of:

- **Native boot integration** — small changes to your Android (`MainActivity` / `MainApplication`) and iOS (`AppDelegate`) so Airborne initializes first and provides the bundle path to React Native.
- **A bundled release config** — `release_config.json` packaged with the app for the first-boot / offline fallback.
- **The JS API** — the `airborne-react-native` package, which exposes helpers such as `getBundlePath`, `readReleaseConfig`, and `getFileContent` for reading what the native SDK downloaded. See the [JavaScript API reference](/docs/react-native-sdk/reference/javascript-api).

## Two integration tracks

The native boot wiring differs slightly depending on your project type:

- **Plain React Native** — integrate directly in `MainActivity`, `MainApplication`, and `AppDelegate`. Start with [Integration in React Native](/docs/react-native-sdk/integration/getting-started).
- **Expo** — the same idea, wrapped in Expo's `ReactActivityDelegateWrapper` / `ReactNativeHostWrapper` and `ExpoAppDelegate`. Start with [Integration in Expo](/docs/react-native-sdk/expo/getting-started).

Both tracks use the same `airborne-react-native` package and the same release config and dimensions concepts described below.

## Core concepts

**Release Config** — the JSON Airborne fetches from your release URL. It describes which package and resources to boot, and is versioned so the SDK can detect and apply updates.

**Package** — the set of files that make up a boot. A package distinguishes **important** files (required for boot — the SDK blocks boot until they are available) from **lazy** files (downloaded in the background and reported as they become available, via the lazy download callback).

**Resources** — additional assets referenced by the release config and downloaded alongside the package.

**Dimensions** — a set of user-defined key/value pairs sent to the release config request as the `x-dimension` header (formatted as `<key1>=<value1>;<key2>=<value2>;` sorted alphabetically by key). Use them to target releases — for example by app version or user segment.

**Namespace** — the scope under which the SDK stores downloaded assets. It must match the application/namespace segment of your release URL, and keeps two SDK instances in the same app from contaminating each other's downloads.

**Boot / release timeouts** — the windows the SDK waits for the release config and downloads to complete on first run. If they elapse before downloads finish, Airborne boots from the bundled assets and continues updating in the background.

## Where to go next

- [Integration in React Native](/docs/react-native-sdk/integration/getting-started) — the plain React Native track.
- [Integration in Expo](/docs/react-native-sdk/expo/getting-started) — the Expo track.
- [JavaScript API](/docs/react-native-sdk/reference/javascript-api), [Android API](/docs/react-native-sdk/reference/android-api), [iOS API](/docs/react-native-sdk/reference/ios-api), and [Callbacks & Events](/docs/react-native-sdk/reference/callbacks-and-events) — the references.
- [Create & target a release](/docs/guides/create-and-target-a-release) — once the SDK is wired up, ship an update.

---
title: Integrate React Native and deliver your first OTA (13 commands on Android)
description: Scaffold a React Native 0.79 app, integrate Airborne, build it, change the text and watch the update arrive on an Android emulator, then repeat on the iOS Simulator.
---

This page takes a brand-new React Native 0.79 app to a visible over-the-air update on a local sandbox. It is **13 commands on Android**, one of which is a native build, plus six lines of environment setup, and five more lines for iOS, which has a second build. It is not a five-minute promise: the native builds and the emulator dominate the time. Every command is meant to be pasted as written; the only values you substitute are your sandbox's port, your two applications and your two access tokens.

## What you need first

| You need | Why | Check |
| --- | --- | --- |
| Node.js 20 or newer and npm | scaffold, CLI, bundler | `node -v` |
| A clone of this repository with `npm ci` run in it | `airborne-devkit@0.45.0` on npm does **not** include `init`, `bundle` or `publish` (checked November 1, 2026) | `npm ci` in the clone |
| JDK 17 on `JAVA_HOME` | Gradle for React Native 0.79 | `java -version` |
| Android SDK with an emulator image, and `ANDROID_HOME` pointing at it | `./gradlew` stops with "SDK location not found" without it | `echo $ANDROID_HOME` (macOS default: `$HOME/Library/Android/sdk`) |
| A running emulator | to see the update | `adb devices` lists one |
| A running Airborne sandbox (`make quickstart` in the clone) and its **API port** | the OTA server | `curl -s http://localhost:<port>/api/health` returns 200 |
| For iOS only: Xcode 16 or newer, Ruby and CocoaPods | simulator build | `xcodebuild -version`, `pod --version` |

React Native 0.78 and 0.79 bare Kotlin/Swift scaffolds are supported; the scaffold command below is pinned to 0.79.2. Newer React Native versions (`npx @react-native-community/cli init` without `--version` currently gives 0.88) are **not** supported and `init` will refuse them.

## Create the two applications and their tokens

An Airborne **application** is one platform of one app, so Android and iOS need separate applications. Create them in the dashboard of your sandbox (the quickstart prints its URL):

1. Open your organisation and choose **`+ Create Application`**; name it `my-android` (the value of `AIRBORNE_APP` below). Repeat with `my-android-ios`, the Android name plus `-ios`.
2. Open the Android application, then **Tokens → Create New Token**, confirm your password, and copy the **Client ID** and **Client Secret** (the secret is shown once). Do the same inside the iOS application.

A token belongs to one organisation and one application, so you will have **one token per platform**: using the Android token against the iOS application is rejected. See [access tokens](/docs/dashboard/access-tokens).

## Run the first OTA on Android

Set these once per terminal. They are used by every command below; `airborne-devkit` is a function so the page works in bash and zsh without installing anything.

```sh
export AIRBORNE_CHECKOUT=/absolute/path/to/airborne
export AIRBORNE_PORT=8080            # your sandbox API port
export AIRBORNE_ORG=quickstart       # your organisation
export AIRBORNE_APP=my-android       # the Android application; iOS uses $AIRBORNE_APP-ios
export ANDROID_HOME="$HOME/Library/Android/sdk"
airborne-devkit() { node "$AIRBORNE_CHECKOUT/airborne_cli/src/index.js" "$@"; }
```

1. Scaffold the app (about a minute, no CocoaPods yet):

   ```sh
   npx @react-native-community/cli@18.0.1 init MyApp --version 0.79.2 --skip-git-init --install-pods false && cd MyApp
   ```

2. Choose the server for **this project**. `configure` saves the URL in `MyApp/.airborne/config.json`, not in the shared CLI checkout, so other projects keep their own server:

   ```sh
   airborne-devkit configure --base-url http://localhost:$AIRBORNE_PORT
   ```

3. Preview the native changes, then apply them. The endpoint is what the **app** will call; `localhost` works on the Simulator and, with `adb reverse` below, on the emulator:

   ```sh
   airborne-devkit init --organisation $AIRBORNE_ORG --application $AIRBORNE_APP --endpoint http://localhost:$AIRBORNE_PORT --dry-run
   airborne-devkit init --organisation $AIRBORNE_ORG --application $AIRBORNE_APP --endpoint http://localhost:$AIRBORNE_PORT
   ```

   `init` edits `MainApplication.kt`, `MainActivity.kt`, `android/build.gradle`, the iOS `AppDelegate.swift` and `Podfile`, and writes `airborne-config.json` plus both platforms' `release_config.json`. Because the endpoint is local plain HTTP it also writes `android/app/src/release/res/xml/network_security_config.xml` (cleartext allowed only to `localhost`, `127.0.0.1`, `10.0.2.2` and your endpoint host) and makes sure `Info.plist` allows local networking, and it prints that. Without them a release build would block the request and silently run its bundled JavaScript. With an HTTPS endpoint it adds none of this; with plain HTTP to a public host it adds nothing and warns. `init` refuses any scaffold it does not recognise, before writing anything, and links the manual instructions. Rerunning it unchanged is a no-op.

4. Give the app a screen that shows which JavaScript is running, so the update is visible (the stock template screen lives in `node_modules`):

   ```sh
   cat > App.tsx <<'EOF'
   import React from 'react';
   import { SafeAreaView, Text } from 'react-native';
   export default function App() {
     return (
       <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
         <Text style={{ fontSize: 28 }}>Bundled JS</Text>
       </SafeAreaView>
     );
   }
   EOF
   ```

5. Install the SDK and build the Release APK (the first build downloads Gradle dependencies; expect minutes):

   ```sh
   npm install && cd android && ./gradlew assembleRelease && cd ..
   ```

6. Reach the sandbox from the emulator and install the app. The object store serves package files from `localhost:4566`, so the emulator needs both ports forwarded:

   ```sh
   adb reverse tcp:$AIRBORNE_PORT tcp:$AIRBORNE_PORT && adb reverse tcp:4566 tcp:4566
   adb install -r android/app/build/outputs/apk/release/app-release.apk && adb shell am start -n com.myapp/.MainActivity
   ```

   The emulator shows **Bundled JS**. That is the JavaScript inside the APK; nothing is published yet.

7. Change the visible text:

   ```sh
   sed -i.bak 's/Bundled JS/First OTA works/' App.tsx && rm App.tsx.bak
   ```

8. Log in with the **Android** token, then publish. Log in now rather than earlier: the access token lasts only minutes (5 on the local sandbox) and the CLI does not store your client secret, so an old login stops every command with "Your Airborne access token has expired" and the `login` line to run again. `login` prints the lifetime, and the token, mappings and server URL live in `.airborne/`, which it adds to `.gitignore`.

   ```sh
   airborne-devkit login --client_id <android client id> --client_secret <android client secret>
   ```

   `publish --conclude` bundles the JavaScript, uploads it, creates the package, prepares an exact-version release, ramps it to 50% (the most a release can be ramped to) and concludes it so every install of the same app version receives it:

   ```sh
   airborne-devkit publish -p android --conclude
   ```

   It prints each stage and ends with JSON naming the **release id**, the **package version** the server assigned and the **app version** it targeted. The app version is read from `android/app/build.gradle` (`versionName "1.0"` in a fresh scaffold) and must equal the installed binary's, because targeting is an exact match: a mismatch simply never serves. Pass `--app-version` if you changed `versionName` to something the CLI cannot read. If a stage fails the error names it and the release id that already exists.

9. Relaunch the app. The release was already concluded, so the relaunch downloads and boots it; give it a few seconds, then read the device log:

   ```sh
   adb logcat -c && adb shell am force-stop com.myapp && adb shell am start -n com.myapp/.MainActivity && sleep 10
   adb logcat -d | grep -E "New app version|Loading package version"
   ```

   The screen now reads **First OTA works**. If it still reads **Bundled JS**, relaunch once more: the package is downloaded in the background and a launch that races the download boots the bundled JavaScript. The scaffold has no on-screen version, so the device log is how you confirm the booted package.

   `Loading package version: <n>` with the package version that `publish` printed is the confirmation. A successful upload or release is not proof that a client booted it.

### Telemetry on the published SDK

`init` installs `airborne-react-native@^0.45.0` from npm, and the published 0.45.0 **does not send boot telemetry**. The dashboard's boot, failure and rollback counts therefore stay empty for an app built this way; the changed screen and the device log above are the only boot evidence. The SDK in this repository (`0.45.0-telemetry.2`) does report boots; use it only through the checkout options in [the section below](#before-a-version-with-init-is-published).

## Run it on iOS too

The iOS application is `$AIRBORNE_APP-ios` (the default `<application>-ios`; `--ios-application` overrides it) and has its own token. `init` already wired iOS in step 3. The Simulator build takes longer than an access token lasts, so log in with the **iOS** token only after it, right before `publish` (this replaces the stored Android login):

```sh
(cd ios && pod install) && xcodebuild -workspace ios/MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -derivedDataPath ios/build -destination "generic/platform=iOS Simulator" build
xcrun simctl install booted ios/build/Build/Products/Release-iphonesimulator/MyApp.app && xcrun simctl launch booted org.reactjs.native.example.MyApp
airborne-devkit login --client_id <ios client id> --client_secret <ios client secret>
airborne-devkit publish -p ios --conclude
xcrun simctl terminate booted org.reactjs.native.example.MyApp && xcrun simctl launch booted org.reactjs.native.example.MyApp
```

Use one booted Simulator (`xcrun simctl list devices booted`). The app first shows **Bundled JS**; after the last line it shows **First OTA works** (relaunch once more if it still shows the old text).

`init` made `ios/Podfile` use static frameworks and patched a header in Apple's `fmt` for Xcode 27. The iOS app version is the Xcode `MARKETING_VERSION` (`1.0` in a fresh scaffold). The Simulator reaches the host as `localhost`, so no port forwarding is needed.

## Doing the steps yourself

`publish --conclude` is these commands in order. Run them individually to stop at a stage, to leave a release at zero traffic for review, or to ramp more gradually:

```sh
airborne-devkit bundle -p android
airborne-devkit create-remote-files -p android --upload
airborne-devkit create-remote-package -p android
airborne-devkit first-release --endpoint http://localhost:$AIRBORNE_PORT --organisation $AIRBORNE_ORG --application $AIRBORNE_APP --package-version <package version printed by the previous step> --app-version 1.0
airborne-devkit ramp-release <release id> -p android --percentage 50
airborne-devkit conclude-release <release id> -p android --variant release
```

`bundle` creates `release_config.json` when it is missing and refreshes it otherwise, so it works right after `init` and after every change (`create-local-release-config` refuses once `init` has written one). `create-remote-package` only uses what `create-remote-files` recorded with the same `-t` tag; if it reports "No uploaded record", run the upload step and fix its error first. `publish --prepare-only` stops with the release at zero traffic and `publish` defaults to stopping after the ramp and prints the exact `conclude-release` command; `--conclude` performs both in one go. The dashboard shows the same release for review.

## Before a version with `init` is published

The commands above run from a checkout because the npm package lacks them. For unpublished SDK changes, `init` accepts `--sdk file:../airborne/airborne-react-native` and `--android-sdk-project ../airborne/airborne_sdk_android/airborne`; the latter adds the matching native module and its build requirements. A local-source build does not verify the published Maven artifact or an npm install.

## Kharcha worked example

Kharcha's earliest native scaffold is React Native 0.78.2 with Kotlin `MainApplication`/`MainActivity` and Swift `RCTAppDelegate`. A second recognized shape is the RN 0.79.2 factory delegate. The checked-in CLI fixtures retain that initial native shape. The generated Android changes are:

```diff
-object : DefaultReactNativeHost(this) {
+object : AirborneReactNativeHost(this@MainApplication) {
+  override fun getJSBundleFile(): String? = airborneInstance.getBundlePath()
-getDefaultReactHost(applicationContext, reactNativeHost)
+AirborneReactNativeHostBase.getReactHost(applicationContext, reactNativeHost)
-DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
+AirborneReactActivityDelegate(this, mainComponentName, fabricEnabled)
```

Initialization runs before React, sends `app_version=BuildConfig.VERSION_NAME`, and persists a per-install rollout bucket. iOS starts React only from `AirborneDelegate.startApp`, using the returned bundle URL; CocoaPods includes the fallback config in the application target. Android keeps the standard `index.android.bundle` at the assets root and puts `release_config.json` under the namespace folder.

The generated integration does not infer native compatibility or enable an automatic rollback policy. Strict creation requires an explicit `app_version` or `version_cohort` target. Compatibility remains the operator's declaration. For custom rules, `compatibility_exception` must explain native compatibility in at least 20 characters; the server audits it before creation. Empty targeting is still refused.

## Measure the two milestones

Record the clone revision, download/cache state, tool versions and start time. **Sandbox ready** is the quickstart's printed readiness duration. **First OTA booted** ends only when changed text and package version are observed in the browser or native app, including integration, dependency installation, compilation and operator actions. Record web and Android separately; mark unavailable or incomplete runs as unverified. Historical 179-second cached sandbox readiness is not a first-OTA measurement or a cold-clone result.

## Verification limits

Run on November 1, 2026 on macOS, from a fresh `npx @react-native-community/cli@18.0.1 init MyApp --version 0.79.2` scaffold in an empty temporary directory, against a locally started Airborne server, with two newly created applications and tokens. A script extracted the code blocks of this page and ran them in order; the only values it substituted were the clone path, the API port, the organisation, the application name and the two token pairs (JDK 17 was already on `JAVA_HOME`). Where a run needed anything else the page was corrected and the run repeated from the start.

- **Android (arm64 emulator, Android 17, default scaffold settings including the new architecture, published `airborne-react-native@0.45.0`).** Three runs on fresh scaffolds and fresh applications; the last, on this exact text, ran every block with exit code 0. The screen read **Bundled JS** after install. In two runs the one relaunch after `publish` showed **First OTA works**; in the last the relaunch raced the download, still showed **Bundled JS**, and the second relaunch the page asks for showed **First OTA works** with `Loading package version: 1` in the device log. The last run took 135 seconds of command time (the scaffold 71 s, the Release build 40 s, `publish` 7 s) and 157 seconds from the first command to the visible update. npm and Gradle caches were warm, so this is not a cold-newcomer time (a cold first Gradle build downloads most of a gigabyte). A second `publish` of changed text produced package 2 and a second concluded release without error.
- **iOS Simulator (Xcode 27.1, Release, arm64, static frameworks).** The same flow with the iOS application and token: `init`'s Podfile, `pod install`, the Release build and `publish -p ios` succeeded and the app showed **First OTA works** after one relaunch. Two page defects were found and fixed on the way: `login` came before a build that outlasted the token (the CLI correctly refused with the expired-token message), and `publish -p ios` ran `bundleRC.rb`, which failed without the `xcodeproj` gem. I did not read the iOS package version from a log; the screen is the evidence there.
- **Telemetry.** With the published 0.45.0 SDK the server's telemetry summary for the app stayed empty (`releases: []`, `verification: "unverified"`) after the Android OTA booted, matching the section above.

Not verified: the dashboard steps (the applications and tokens were created through the API the dashboard calls, not clicked), a cold-cache or Linux/Windows run, a physical device, an HTTPS endpoint, newer React Native versions (refused by `init`), an application with an approval policy (`publish` stops at release creation and names the uploaded package; raise the approval request from the dashboard), and an expired token rejected by the server rather than caught by the CLI's recorded expiry (unit-tested, not provoked). Published npm/Maven pairing beyond the 0.45.0 used here and the local-source SDK build remain unverified.

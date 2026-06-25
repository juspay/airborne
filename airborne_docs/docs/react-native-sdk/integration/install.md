---
title: Install the SDK
description: Add the airborne-react-native package and the Airborne Maven repository to your React Native project.
---

Install the `airborne-react-native` package and register the Airborne Maven repository so Android can resolve the native SDK. After this, continue with the native [Android](/react-native-sdk/integration/android-setup) and [iOS](/react-native-sdk/integration/ios-setup) setup.

## Add the dependency

Add `airborne-react-native` to your `package.json`:

```json
{
  "dependencies": {
    "airborne-react-native": "^0.37.0"
  }
}
```

Then install:

```bash
npm install
```

:::tip
You can also add it directly with `npm install airborne-react-native@^0.37.0` (or the `yarn`/`pnpm` equivalent), which updates `package.json` for you.
:::

## Install iOS pods

The package ships native iOS code, so install pods after adding the dependency:

```bash
cd ios && pod install
```

If you use the React Native community CLI, `npx pod-install` works as well.

## Add the Airborne Maven repository (Android)

The native Android SDK is distributed from Airborne's Maven repository. Add it to your Android Gradle configuration so the dependency can be resolved.

If your project declares repositories in `android/build.gradle` (under `allprojects { repositories { ... } }`):

```groovy
allprojects {
    repositories {
        maven { url "https://maven.juspay.in/jp-build-packages/hyper-sdk/" }
    }
}
```

If your project uses the newer Gradle settings model, add it to `android/settings.gradle` instead (under `dependencyResolutionManagement { repositories { ... } }`):

```groovy
dependencyResolutionManagement {
    repositories {
        maven { url "https://maven.juspay.in/jp-build-packages/hyper-sdk/" }
    }
}
```

:::caution
Add the repository in exactly one place. If `dependencyResolutionManagement` is configured with `RepositoriesMode.FAIL_ON_PROJECT_REPOS`, declaring repositories in `build.gradle` will fail the build — put the Maven URL in `settings.gradle` instead.
:::

## Next

Continue with **[Android setup](/react-native-sdk/integration/android-setup)**.

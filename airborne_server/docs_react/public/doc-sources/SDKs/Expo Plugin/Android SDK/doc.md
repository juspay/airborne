This document outlines the steps to integrate the AirborneReact SDK into your Expo Android application.

> **Prerequisites:** Make sure you have installed `airborne-react-native` in your Expo project before proceeding. See the **Expo Plugin** section in the sidebar for installation instructions.

## Step 1: Add Maven Repository

Add the Airborne Maven repository to your project's `build.gradle` (or `settings.gradle` if using the new Gradle settings).

## Step 2: Update MainActivity

In your `MainActivity.kt`, import the `AirborneReactActivityDelegate` and update the `createReactActivityDelegate` function.

This delegate handles the React Native activity lifecycle with Airborne's bundle management, wrapped with Expo's `ReactActivityDelegateWrapper`.

## Step 3: Add Imports in MainApplication

Add the required Airborne imports to your `MainApplication.kt` file. These imports provide access to the Airborne SDK classes needed for initialization and configuration.

## Step 4: Add Class Variables

Create the following variables inside your `MainApplication` class:

- `bundlePath`: Stores the path to the JS bundle provided by Airborne
- `isBootComplete`: Tracks whether Airborne has finished loading the bundle
- `bootCompleteListener`: Callback triggered when boot is complete
- `airborneInstance`: Reference to the Airborne SDK instance

## Step 5: Update ReactNativeHost

Replace the default `ReactNativeHost` with `AirborneReactNativeHost` wrapped in Expo's `ReactNativeHostWrapper`. This custom host integrates with Airborne to:

- Load the JS bundle from Airborne's managed path via `getJSBundleFile()`
- Use Expo's virtual metro entry as the main module
- Support both old and new React Native architecture

## Step 6: Create initializeAirborne Function

Create the `initializeAirborne()` function inside your `MainApplication` class. This function:

1. Creates an `Airborne` instance with your server URL
2. Implements `AirborneInterface` with the required callbacks:
   - `getDimensions()`: Return custom dimensions for targeting (e.g., app version, user segment)
   - `onEvent()`: Receive SDK events for logging/analytics
   - `startApp()`: Called when the bundle is ready - sets the bundle path and triggers boot complete

Replace `<organisation-name>` and `<application/namespace-name>` with your actual values.

## Step 7: Update onCreate

Update the `onCreate()` method to initialize Airborne before loading React Native. This ensures Airborne is ready to provide the bundle path when React Native starts.

## Bundling Release Config (For non-CLI users)

If you are not using Airborne CLI for bundling `release_config.json`, ensure the bundled config is placed inside the `namespace` folder of assets. For example, if the namespace is `example`, the path should be `app/src/main/assets/example/release_config.json`.

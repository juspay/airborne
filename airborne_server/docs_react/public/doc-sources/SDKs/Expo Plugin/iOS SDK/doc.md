This document outlines the steps to integrate the AirborneReact SDK into your Expo iOS application.

> **Prerequisites:** Make sure you have installed `airborne-react-native` in your Expo project before proceeding. See the **Expo Plugin** section in the sidebar for installation instructions.

## Step 1: Add Bridging Header

Create a bridging header file (if not already present) and import the Airborne header. This allows Swift code to access the Objective-C Airborne SDK.

## Step 2: Add Class Variables in AppDelegate

Add the required variables to your `AppDelegate` class:

- `launchOptions`: Stores the launch options for later use when starting React Native
- `airborne`: Reference to the Airborne SDK instance

## Step 3: Create initializeHyperOTA Function

Create the `initializeHyperOTA()` function inside your `AppDelegate` class. This initializes the Airborne SDK with your release config URL and sets the delegate.

Replace `<organisation>` and `<application/namespace-name>` with your actual values.

## Step 4: Update application Function

Note: In Expo, there are three application functions. Update only the `application(_:didFinishLaunchingWithOptions:)` method to:

1. Save the launch options for later use
2. Initialize HyperOTA before anything else
3. Create the main window early
4. Call the super implementation

## Step 5: Implement AirborneDelegate Extension

Create an extension on `AppDelegate` that conforms to `AirborneDelegate`. Implement the required methods:

- `getNamespace()`: Return your app's namespace (must match CLI config)
- `getBundle()`: Return the bundle containing your JS bundle
- `getDimensions()`: Return custom dimensions for targeting
- `onEvent()`: Receive SDK events for logging/analytics
- `startApp()`: Called when the bundle is ready - initialize React Native with the provided bundle URL and bind the factory

## Step 6: Update ReactNativeDelegate

Update the existing `ReactNativeDelegate` class to accept and provide the Airborne bundle URL to React Native.

## Bundling Release Config

If you are using Airborne CLI, the `release_config.json` will be bundled inside your app's main bundle automatically at `ios/release_config.json`.

> **Important:** Make sure to add the `release_config.json` file to your Xcode project. Simply placing the file in the `ios/` folder does not automatically include it in the build. In Xcode, right-click your project folder → "Add Files to [YourProject]" → select `release_config.json` → ensure "Copy items if needed" is checked and the target is selected.

### For non-CLI users

If you are not using Airborne CLI for bundling `release_config.json`, ensure the bundled config is placed at `ios/release_config.json` and added to your Xcode project.

This document outlines the steps to integrate the AirborneReact SDK into your iOS application.

## 1. Import AirborneReact

First, you need to import the `AirborneReact` framework in your `AppDelegate.swift` file.

## 2. Conform to AirborneReactDelegate

Next, make your `AppDelegate` class conform to the `AirborneReactDelegate` protocol.

## 3. Initialize Airborne

Initialize the Airborne SDK within the `application(_:didFinishLaunchingWithOptions:)` method. This is typically done by calling a helper method like `initializeHyperOTA()`.

## 4. Implement Delegate Methods

You need to implement the required methods from the `AirborneReactDelegate` protocol.

### startApp

This method is called when the Airborne bundle is ready. You should use this to start your React Native application.

### getDimensions

This method allows you to provide custom dimensions to the Airborne SDK.

### getNamespace

The unique identifier of your app. Make sure that this is the same given in the CLI config also.

### getBundle

The assets bundle of your app/sdk where your bundled jsBundle file is present.

### onEvent

This method is a callback for events from the Airborne SDK.

## 5. Bundling Release Config
If you are using Airborne CLI then the `release_config.json` will always be bundled inside your app/sdk's main bundle. If you are providing different bundle in the `getBundle` function then please move the bundled `release_config.json` file under that bundle.

### For non CLI users
If you are not using Airborne CLI for bundling release_config.json, then you have to make sure that the bundled `release_config` is under the bundle you passed to the `getBundle` function.

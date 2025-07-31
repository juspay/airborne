This document outlines the steps to integrate the AirborneReact SDK into your Android application.

## 1. Initialize Airborne

Initialize the Airborne SDK within the `onCreate()` method of your `MainApplication.kt` file.

## 2. Implement AirborneInterface

You need to implement the required methods from the `AirborneInterface`.

### getDimensions

This method allows you to provide custom dimensions to the Airborne SDK.

### getNamespace

The unique identifier of your app. Make sure that this is the same given in the CLI config also.

### onEvent

This method is a callback for events from the Airborne SDK.

### startApp

This method is called when the Airborne bundle is ready. You should use this to set the bundle path for React Native.

## 3. Bundling Release Config (For non CLI users)

If you are not using Airborne CLI for bundling release_config.json, then you have to make sure that the bundled `release_config` is right inside the `namespace` folder of the assets. If the namespace is `example` then the release_config should be in the `example/release_config.json` path in the assets.

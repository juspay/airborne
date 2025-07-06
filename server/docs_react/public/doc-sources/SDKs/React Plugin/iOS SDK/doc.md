This document outlines the steps to integrate the AirborneReact SDK into your iOS application.

## 1. Import AirborneReact

First, you need to import the `AirborneReact` framework in your `AppDelegate.swift` file.

## 2. Conform to AirborneReactDelegate

Next, make your `AppDelegate` class conform to the `AirborneReactDelegate` protocol.

## 3. Initialize Airborne

Initialize the Airborne SDK within the `application(_:didFinishLaunchingWithOptions:)` method. This is typically done by calling a helper method like `initializeHyperOTA()`.

## 4. Implement Delegate Methods

You need to implement the required methods from the `AirborneReactDelegate` protocol.

### onBootComplete

This method is called when the Airborne bundle is ready. You should use this to start your React Native application.

### getDimensions

This method allows you to provide custom dimensions to the Airborne SDK.

### onEvent

This method is a callback for events from the Airborne SDK.

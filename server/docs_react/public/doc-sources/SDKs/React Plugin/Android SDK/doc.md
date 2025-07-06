This document outlines the steps to integrate the AirborneReact SDK into your Android application.

## 1. Initialize Airborne

Initialize the Airborne SDK within the `onCreate()` method of your `MainApplication.kt` file.

## 2. Implement AirborneInterface

You need to implement the required methods from the `AirborneInterface`.

### getDimensions

This method allows you to provide custom dimensions to the Airborne SDK.

### onEvent

This method is a callback for events from the Airborne SDK.

### onBootComplete

This method is called when the Airborne bundle is ready. You should use this to set the bundle path for React Native.

---
title: iOS Setup
description: Wire up the bridging header and AppDelegate so Airborne boots before React Native and serves the OTA bundle on iOS.
---

This page covers the full iOS integration for a plain React Native app: adding the bridging header, the `AppDelegate` variables and initializer, the `application(_:didFinishLaunchingWithOptions:)` update, the `AirborneDelegate` extension, and the `ReactNativeDelegate` update.

:::note[Prerequisites]
Make sure you have completed [Install the SDK](/docs/react-native-sdk/integration/install), including running `pod install`, before proceeding.
:::

## Step 1: Add the bridging header

Create a bridging header (if your project does not already have one) and import the Airborne header. This lets your Swift code reach the Objective-C Airborne SDK.

```objc
// YourApp-Bridging-Header.h
// Add this import to access Airborne from Swift

#import <AirborneReact/Airborne.h>
```

## Step 2: Add class variables in AppDelegate

Add these variables to your `AppDelegate` class:

- `launchOptions` — stores the launch options for later use when starting React Native.
- `airborne` — reference to the Airborne SDK instance.

```swift
// Add these variables in AppDelegate class

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    private var airborne: Airborne?

    // ... rest of the class
}
```

## Step 3: Create initializeHyperOTA()

Create an `initializeHyperOTA()` function inside `AppDelegate`. It initializes the Airborne SDK with your release config URL and sets the delegate.

Replace `<organisation>` and `<application/namespace-name>` with your actual values.

```swift
// Create initializeHyperOTA function in AppDelegate

private func initializeHyperOTA() {
    airborne = Airborne(
        releaseConfigURL: "https://airborne.juspay.in/release/<organisation>/<application/namespace-name>",
        delegate: self
    )
    print("HyperOTA: Initialized successfully")
}
```

## Step 4: Update the application function

Update the body of `application(_:didFinishLaunchingWithOptions:)` to:

1. Save the launch options for later use.
2. Initialize HyperOTA before anything else.
3. Create the main window early.

```swift
// Update the body of application function in AppDelegate

func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
) -> Bool {
    // Save launch options for later use
    self.launchOptions = launchOptions

    // Initialize HyperOTA first
    initializeHyperOTA()

    // Create the main window early
    self.window = UIWindow(frame: UIScreen.main.bounds)

    return true
}
```

Note that React Native is **not** started here — it is started later from the `startApp` delegate method, once Airborne has the OTA bundle ready.

## Step 5: Implement the AirborneDelegate extension

Create an extension on `AppDelegate` that conforms to `AirborneDelegate` and implement the required methods:

- `namespace()` — return your app's namespace (must match the release URL segment and the bundled config folder).
- `bundle()` — return the bundle that contains your JS bundle.
- `dimensions()` — return custom dimensions for targeting.
- `onEvent()` — receive SDK events for logging or analytics.
- `startApp()` — called when the bundle is ready; initialize React Native with the provided bundle URL.

```swift
// Implement AirborneDelegate extension

extension AppDelegate: AirborneDelegate {

    func namespace() -> String {
        return "<application/namespace-name>"
    }

    func bundle() -> Bundle {
        return Bundle.main
    }

    func dimensions() -> [String : String] {
        // Add custom dimensions for targeting, e.g.:
        // return ["app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""]
        return [:]
    }

    func onEvent(level: String, label: String, key: String, value: [String : Any], category: String, subcategory: String) {
        print("Event: \(key) = \(value)")
    }

    func startApp(indexBundleURL: URL?) {
        DispatchQueue.main.async { [self] in

            let delegate = ReactNativeDelegate(customPath: indexBundleURL)
            let factory = RCTReactNativeFactory(delegate: delegate)
            delegate.dependencyProvider = RCTAppDependencyProvider()

            reactNativeDelegate = delegate
            reactNativeFactory = factory

            factory.startReactNative(
                withModuleName: "YourAppName",  // Replace with your app name
                in: window,
                launchOptions: self.launchOptions
            )

        }
    }
}
```

Replace `YourAppName` with your registered module name.

## Step 6: Update ReactNativeDelegate

Update the existing `ReactNativeDelegate` class to accept and provide the Airborne bundle URL to React Native.

```swift
// Update existing ReactNativeDelegate class

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {

    private let customPath: URL?

    init(customPath: URL?) {
        self.customPath = customPath
        super.init()
    }

    override func sourceURL(for bridge: RCTBridge) -> URL? {
        self.bundleURL()
    }

    override func bundleURL() -> URL? {
        customPath
    }
}
```

:::caution[Namespace must match]
The string returned by `namespace()` must match the `<application/namespace-name>` segment of your release URL and the bundled config location. A mismatch means the SDK cannot find the correct bundle.
:::

## Next

Continue with **[Bundling the release config](/docs/react-native-sdk/integration/bundling-release-config)**.

---
title: iOS Setup (Expo)
description: Wire the Airborne SDK into an Expo iOS app by initializing Airborne in your ExpoAppDelegate and implementing the AirborneDelegate.
---

This page wires Airborne into the iOS side of an Expo app. The flow mirrors the [plain React Native track](/docs/react-native-sdk/integration/ios-setup): initialize Airborne early in the app delegate, then start React Native from the `startApp` delegate callback using the bundle URL Airborne provides. The Expo specifics are that your app delegate extends `ExpoAppDelegate`, that Expo generates **three** `application` functions (you update only `didFinishLaunchingWithOptions`), and that the React Native factory is bound via `bindReactNativeFactory` and started with module name `"main"`.

:::note[Prerequisites]
Make sure you have installed `airborne-react-native` and run `npx expo prebuild` so the `ios/` project exists, then run `pod install`. See [Getting started](/docs/react-native-sdk/expo/getting-started).
:::

## Step 1: Add a bridging header

Create a bridging header (if your project does not already have one) and import the Airborne header so Swift can access the Airborne SDK.

```objc
// YourApp-Bridging-Header.h
#import <AirborneReact/Airborne.h>
```

## Step 2: Add class variables in AppDelegate

Add the required variables to your `AppDelegate`, which extends `ExpoAppDelegate`:

- `launchOptions` — stores the launch options for later use when starting React Native.
- `airborne` — the Airborne SDK instance.

```swift
@main
public class AppDelegate: ExpoAppDelegate {

    var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    private var airborne: Airborne?

    // ... rest of the class
}
```

:::note[reactNativeDelegate and reactNativeFactory]
Your generated `ExpoAppDelegate` subclass already declares `reactNativeDelegate` and `reactNativeFactory` properties used to start React Native. The `startApp` callback in Step 5 assigns to them.
:::

## Step 3: Create the initializeHyperOTA function

Add an `initializeHyperOTA()` function inside `AppDelegate`. It initializes the Airborne SDK with your release config URL and sets `self` as the delegate.

Replace `<organisation>` and `<application/namespace-name>` with your actual values.

```swift
private func initializeHyperOTA() {
    airborne = Airborne(
        releaseConfigURL: "https://airborne.juspay.in/release/<organisation>/<application/namespace-name>",
        delegate: self
    )
    print("HyperOTA: Initialized successfully")
}
```

## Step 4: Update the application function

Expo generates **three** `application` functions in the app delegate. Update **only** `application(_:didFinishLaunchingWithOptions:)`. Leave the other two untouched. In this method:

1. Save the launch options for later use.
2. Initialize HyperOTA before anything else.
3. Create the main window early.
4. Call the `super` implementation.

```swift
public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
) -> Bool {
    self.launchOptions = launchOptions

    // Initialize HyperOTA first
    initializeHyperOTA()

    // Create the main window early
    window = UIWindow(frame: UIScreen.main.bounds)

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
}
```

:::warning[Update only didFinishLaunchingWithOptions]
The other two `application` functions Expo generates handle URL/universal-link routing and must keep calling their `super` implementations. Only the launch method needs Airborne wiring.
:::

## Step 5: Implement the AirborneDelegate extension

Add an extension on `AppDelegate` that conforms to `AirborneDelegate`. Implement:

- `namespace()` — your app's namespace (must match the namespace segment of your release URL and your bundling config).
- `bundle()` — the bundle containing your bundled JS and `release_config.json`.
- `dimensions()` — custom dimensions for targeting.
- `onEvent()` — receives SDK events for logging and analytics.
- `startApp(indexBundleURL:)` — called when the bundle is ready. Create the `ReactNativeDelegate` with the provided bundle URL, build the factory, bind it via `bindReactNativeFactory`, and start React Native with module name `"main"`.

```swift
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

    public func onEvent(level: String, label: String, key: String, value: [String : Any], category: String, subcategory: String) {
        print("Event: \(key) = \(value)")
    }

    public func startApp(indexBundleURL: URL?) {
        DispatchQueue.main.async { [self] in

            let delegate = ReactNativeDelegate(customPath: indexBundleURL)
            let factory = RCTReactNativeFactory(delegate: delegate)
            delegate.dependencyProvider = RCTAppDependencyProvider()

            reactNativeDelegate = delegate
            reactNativeFactory = factory
            bindReactNativeFactory(factory)

            factory.startReactNative(
                withModuleName: "main",
                in: window,
                launchOptions: self.launchOptions
            )

        }
    }
}
```

:::tip[bindReactNativeFactory and "main"]
Two Expo-specific details: call `bindReactNativeFactory(factory)` (provided by `ExpoAppDelegate`) before starting, and pass `withModuleName: "main"` — Expo registers its root component under `main`, not your app name.
:::

See the [iOS API reference](/docs/react-native-sdk/reference/ios-api) for the full `AirborneDelegate` protocol and the [callbacks & events reference](/docs/react-native-sdk/reference/callbacks-and-events) for the events delivered to `onEvent`.

## Step 6: Update ReactNativeDelegate

Update the generated `ReactNativeDelegate` class to accept the Airborne bundle URL and hand it to React Native.

```swift
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

## Next steps

- [Bundle the release config](/docs/react-native-sdk/expo/bundling-release-config) for the first-boot / offline fallback.
- If you have not done so yet, complete [Android setup](/docs/react-native-sdk/expo/android-setup).

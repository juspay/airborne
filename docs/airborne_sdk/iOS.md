# Airborne iOS SDK Integration Guide

Complete guide for integrating Airborne OTA updates into native iOS applications.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Components](#core-components)
- [Integration Steps](#integration-steps)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Overview

The Airborne iOS SDK provides Over-The-Air (OTA) update capabilities for iOS applications. It enables you to:

- 📦 Download and manage application updates without App Store submission
- 🚀 Load JavaScript bundles dynamically (for hybrid apps)
- 🎯 Serve different content based on user dimensions
- 💾 Cache downloaded assets for offline use
- 🔄 Implement lazy loading for non-critical resources
- 📊 Track update lifecycle events

### Key Features

- **Swift-First**: Written in modern Swift with Objective-C compatibility
- **Thread-Safe**: All operations are thread-safe by default
- **Delegate Pattern**: Clean delegate-based API for callbacks
- **Flexible Configuration**: Support for release configurations via URL or bundled assets
- **Event Tracking**: Comprehensive event system for monitoring and analytics
- **Fallback Support**: Automatic fallback to bundled assets if OTA fails

## Installation

### CocoaPods

Add Airborne to your `Podfile`:

```ruby
source 'https://github.com/CocoaPods/Specs.git'
platform :ios, '12.0'

target 'YourApp' do
  use_frameworks!
  
  # Airborne SDK
  pod 'Airborne', :git => 'https://github.com/juspay/airborne.git', :tag => 'v0.15.1'
  
  # Your other dependencies
end
```

Install the pod:

```bash
cd ios
pod install
cd ..
```

### Swift Package Manager

Add Airborne to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/juspay/airborne.git", from: "0.15.1")
]
```

Or add it via Xcode:
1. File → Add Packages...
2. Enter: `https://github.com/juspay/airborne.git`
3. Select version: 0.15.1 or later

### Minimum Requirements

- **iOS**: 12.0+
- **Xcode**: 14.0+
- **Swift**: 5.5+

## Quick Start

### Basic Implementation in AppDelegate

```swift
import UIKit
import Airborne

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?
    private var airborne: AirborneServices?
    private var bundleURL: URL?
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        
        // Initialize Airborne
        let releaseConfigURL = "https://your-server.com/release/your-namespace/ios"
        airborne = AirborneServices(
            releaseConfigURL: releaseConfigURL,
            delegate: self
        )
        
        return true
    }
}

// MARK: - AirborneDelegate

extension AppDelegate: AirborneDelegate {
    
    func namespace() -> String {
        return "your-app-namespace"
    }
    
    func bundle() -> Bundle {
        return Bundle.main
    }
    
    func dimensions() -> [String: String] {
        return [
            "city": "bangalore",
            "userType": "premium",
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        ]
    }
    
    func startApp(indexBundleURL: URL?) {
        print("Airborne boot complete!")
        self.bundleURL = indexBundleURL
        
        // Start your app here
        DispatchQueue.main.async { [weak self] in
            self?.loadMainViewController()
        }
    }
    
    func onEvent(
        level: String,
        label: String,
        key: String,
        value: [String: Any],
        category: String,
        subcategory: String
    ) {
        print("Airborne Event: \(level) - \(key)")
        // Send to your analytics system
    }
    
    func onLazyPackageDownloadComplete(
        downloadSuccess: Bool,
        url: String,
        filePath: String
    ) {
        print("Lazy package downloaded: \(url), success: \(downloadSuccess)")
    }
    
    func onAllLazyPackageDownloadsComplete() {
        print("All lazy packages downloaded")
    }
    
    private func loadMainViewController() {
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        let viewController = storyboard.instantiateInitialViewController()
        window?.rootViewController = viewController
        window?.makeKeyAndVisible()
    }
}
```

### For React Native Apps

If you're using Airborne with React Native:

```swift
import React

extension AppDelegate: RCTBridgeDelegate {
    
    func sourceURL(for bridge: RCTBridge) -> URL? {
        #if DEBUG
        return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        #else
        // Return the OTA bundle URL from Airborne
        return airborne?.getIndexBundlePath()
        #endif
    }
}
```

## Core Components

### 1. AirborneServices

The main entry point for the SDK. Manages the OTA update lifecycle.

```swift
let airborne = AirborneServices(
    releaseConfigURL: "https://your-server.com/release/namespace/ios",
    delegate: self
)
```

**Methods**:
- `getIndexBundlePath() -> URL` - Gets the path to the current bundle
- `getReleaseConfig() -> String?` - Gets the release configuration as JSON
- `getFileContent(filePath: String) -> String?` - Reads file content from OTA bundle
- `getBaseBundle() -> Bundle` - Gets the base bundle for fallback assets

### 2. AirborneDelegate Protocol

Implement this protocol to receive callbacks and customize behavior:

```swift
@objc public protocol AirborneDelegate {
    @objc optional func namespace() -> String
    @objc optional func bundle() -> Bundle
    @objc optional func dimensions() -> [String: String]
    @objc optional func startApp(indexBundleURL: URL?)
    @objc optional func onEvent(level: String, label: String, key: String, 
                                value: [String: Any], category: String, 
                                subcategory: String)
    @objc optional func onLazyPackageDownloadComplete(downloadSuccess: Bool, 
                                                       url: String, filePath: String)
    @objc optional func onAllLazyPackageDownloadsComplete()
}
```

**Delegate Methods**:

- **`namespace()`**: Returns your app's unique identifier
  - Default: `"juspay"`
  - Use: Isolate configurations across apps/environments

- **`bundle()`**: Returns the bundle containing fallback assets
  - Default: `Bundle.main`
  - Use: Provide custom bundle for testing or modular apps

- **`dimensions()`**: Returns key-value pairs for customized configurations
  - Default: `[:]` (empty)
  - Use: A/B testing, user segmentation, feature flags

- **`startApp(indexBundleURL:)`**: Called when OTA boot completes
  - Use: Load main UI, start React Native bridge

- **`onEvent(...)`**: Called for lifecycle events
  - Use: Analytics, monitoring, debugging

- **`onLazyPackageDownloadComplete(...)`**: Called when a lazy package downloads
  - Use: Track lazy content availability

- **`onAllLazyPackageDownloadsComplete()`**: Called when all lazy downloads finish
  - Use: Notify user all content is available

## Integration Steps

### Step 1: Import Airborne

```swift
import Airborne
```

### Step 2: Initialize in AppDelegate

```swift
import UIKit
import Airborne

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?
    private var airborne: AirborneServices?
    private var isAirborneReady = false
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        
        setupAirborne()
        return true
    }
    
    private func setupAirborne() {
        let config = AirborneConfig.load()
        
        airborne = AirborneServices(
            releaseConfigURL: config.releaseURL,
            delegate: self
        )
    }
}
```

### Step 3: Implement AirborneDelegate

```swift
extension AppDelegate: AirborneDelegate {
    
    func namespace() -> String {
        return Configuration.namespace
    }
    
    func dimensions() -> [String: String] {
        var dims: [String: String] = [:]
        
        // App version
        if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
            dims["appVersion"] = version
        }
        
        // Build number
        if let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
            dims["buildNumber"] = build
        }
        
        // Device type
        dims["deviceType"] = UIDevice.current.userInterfaceIdiom == .pad ? "tablet" : "phone"
        
        // iOS version
        dims["iosVersion"] = UIDevice.current.systemVersion
        
        // User-specific
        if let user = UserManager.shared.currentUser {
            dims["userId"] = user.id
            dims["userType"] = user.isPremium ? "premium" : "free"
        }
        
        // Location
        if let city = LocationManager.shared.currentCity {
            dims["city"] = city
        }
        
        return dims
    }
    
    func startApp(indexBundleURL: URL?) {
        isAirborneReady = true
        
        print("✅ Airborne ready with bundle: \(String(describing: indexBundleURL))")
        
        DispatchQueue.main.async { [weak self] in
            self?.loadApplication()
        }
    }
    
    func onEvent(
        level: String,
        label: String,
        key: String,
        value: [String: Any],
        category: String,
        subcategory: String
    ) {
        // Map to your analytics system
        Analytics.track(
            event: key,
            properties: value,
            category: category,
            level: level
        )
        
        // Log for debugging
        if level == "error" {
            print("❌ Airborne Error: \(key) - \(value)")
        } else {
            print("ℹ️ Airborne: \(key)")
        }
    }
    
    func onLazyPackageDownloadComplete(
        downloadSuccess: Bool,
        url: String,
        filePath: String
    ) {
        if downloadSuccess {
            print("✅ Lazy package ready: \(url)")
            NotificationCenter.default.post(
                name: .lazyContentAvailable,
                object: nil,
                userInfo: ["url": url, "path": filePath]
            )
        } else {
            print("❌ Lazy package failed: \(url)")
        }
    }
    
    func onAllLazyPackageDownloadsComplete() {
        print("✅ All lazy content downloaded")
        NotificationCenter.default.post(name: .allLazyContentAvailable, object: nil)
        
        // Show notification to user if app is in foreground
        if UIApplication.shared.applicationState == .active {
            showLazyContentReadyNotification()
        }
    }
    
    private func loadApplication() {
        // Your app loading logic
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        if let viewController = storyboard.instantiateInitialViewController() {
            window?.rootViewController = viewController
            window?.makeKeyAndVisible()
        }
    }
}
```

### Step 4: Handle Splash Screen (Optional)

Create a splash view controller that waits for Airborne:

```swift
import UIKit

class SplashViewController: UIViewController {
    
    @IBOutlet weak var activityIndicator: UIActivityIndicatorView!
    @IBOutlet weak var statusLabel: UILabel!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        activityIndicator.startAnimating()
        statusLabel.text = "Loading..."
        
        checkAirborneStatus()
    }
    
    private func checkAirborneStatus() {
        guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
            return
        }
        
        if appDelegate.isAirborneReady {
            loadMainApp()
        } else {
            // Check again after a delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                self?.checkAirborneStatus()
            }
        }
    }
    
    private func loadMainApp() {
        // Transition to main app
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        guard let mainVC = storyboard.instantiateInitialViewController() else {
            return
        }
        
        mainVC.modalTransitionStyle = .crossDissolve
        mainVC.modalPresentationStyle = .fullScreen
        present(mainVC, animated: true)
    }
}
```

### Step 5: Configure Info.plist

Add necessary permissions and configurations:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>your-airborne-server.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
            <key>NSIncludesSubdomains</key>
            <true/>
        </dict>
    </dict>
</dict>
```

## API Reference

### Getting the Bundle Path

```swift
if let bundleURL = airborne?.getIndexBundlePath() {
    print("Current bundle: \(bundleURL.path)")
    
    // Check if it's an OTA bundle
    let isOTA = bundleURL.path.contains("/airborne/")
    print("Using OTA: \(isOTA)")
}
```

### Reading Release Configuration

```swift
if let configJSON = airborne?.getReleaseConfig() {
    do {
        if let data = configJSON.data(using: .utf8),
           let config = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            
            let appVersion = config["app_version"] as? String
            let packages = config["packages"] as? [[String: Any]]
            
            print("App version: \(appVersion ?? "unknown")")
            print("Packages: \(packages?.count ?? 0)")
        }
    } catch {
        print("Failed to parse config: \(error)")
    }
}
```

### Reading File Content

```swift
// Read a JSON config file
if let content = airborne?.getFileContent(filePath: "config/features.json") {
    do {
        if let data = content.data(using: .utf8),
           let features = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            
            let enableNewUI = features["enableNewUI"] as? Bool ?? false
            print("New UI enabled: \(enableNewUI)")
        }
    } catch {
        print("Failed to parse file: \(error)")
    }
}

// Read a text file
if let readme = airborne?.getFileContent(filePath: "docs/readme.txt") {
    print("README content:\n\(readme)")
}
```

## Configuration

### Release Configuration URL Format

```
https://your-server.com/release/{namespace}/{platform}
```

**Example**:
```swift
let releaseURL = "https://airborne.example.com/release/com.mycompany.myapp/ios"
```

### Namespace Best Practices

Use reverse domain notation and separate environments:

```swift
// Production
let namespace = "com.mycompany.myapp.production"

// Staging
let namespace = "com.mycompany.myapp.staging"

// Development
let namespace = "com.mycompany.myapp.development"
```

### Dimensions for User Segmentation

```swift
func dimensions() -> [String: String] {
    var dims: [String: String] = [:]
    
    // App metadata
    dims["appVersion"] = Bundle.main.appVersion
    dims["buildNumber"] = Bundle.main.buildNumber
    dims["bundleId"] = Bundle.main.bundleIdentifier
    
    // Device info
    dims["deviceModel"] = UIDevice.current.model
    dims["deviceType"] = UIDevice.current.deviceType
    dims["iosVersion"] = UIDevice.current.systemVersion
    dims["screenSize"] = UIScreen.main.screenSize
    
    // User info
    if let user = UserManager.shared.currentUser {
        dims["userId"] = user.id
        dims["userType"] = user.tier.rawValue
        dims["signupDate"] = user.signupDate.iso8601
    }
    
    // Location
    dims["country"] = Locale.current.regionCode ?? "US"
    dims["language"] = Locale.current.languageCode ?? "en"
    
    // Feature flags
    dims["betaFeatures"] = FeatureFlags.betaEnabled ? "true" : "false"
    
    // Experiment groups
    dims["experimentGroup"] = ExperimentManager.shared.currentGroup
    
    return dims
}
```

### Custom Bundle for Testing

```swift
func bundle() -> Bundle {
    #if DEBUG
    // Use a test bundle in development
    if let testBundlePath = Bundle.main.path(forResource: "TestBundle", ofType: "bundle"),
       let testBundle = Bundle(path: testBundlePath) {
        return testBundle
    }
    #endif
    
    return Bundle.main
}
```

## Advanced Features

### Background Updates

```swift
import BackgroundTasks

class AirborneBackgroundManager {
    
    static let shared = AirborneBackgroundManager()
    private let taskIdentifier = "com.yourapp.airborne.refresh"
    
    func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: taskIdentifier,
            using: nil
        ) { task in
            self.handleBackgroundUpdate(task: task as! BGAppRefreshTask)
        }
    }
    
    func scheduleBackgroundUpdate() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 3600) // 1 hour
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("Background update scheduled")
        } catch {
            print("Failed to schedule: \(error)")
        }
    }
    
    private func handleBackgroundUpdate(task: BGAppRefreshTask) {
        scheduleBackgroundUpdate() // Schedule next update
        
        task.expirationHandler = {
            // Handle expiration
        }
        
        // Check for updates
        // ...
        
        task.setTaskCompleted(success: true)
    }
}
```

### Custom HTTP Headers via Dimensions

Dimensions are sent as HTTP headers when fetching the release configuration:

```swift
func dimensions() -> [String: String] {
    return [
        "Authorization": "Bearer \(authToken)",
        "X-Custom-Header": "custom-value",
        "X-Device-ID": UIDevice.current.identifierForVendor?.uuidString ?? ""
    ]
}
```

### Logging and Analytics Integration

```swift
func onEvent(
    level: String,
    label: String,
    key: String,
    value: [String: Any],
    category: String,
    subcategory: String
) {
    // Firebase Analytics
    Analytics.logEvent(key, parameters: value)
    
    // Mixpanel
    Mixpanel.mainInstance().track(event: key, properties: value)
    
    // Custom logging
    let logLevel = LogLevel(rawValue: level) ?? .info
    Logger.log(logLevel, message: "\(label): \(key)", metadata: value)
    
    // Crashlytics for errors
    if level == "error" {
        Crashlytics.crashlytics().record(error: AirborneError(key: key, details: value))
    }
}
```

### Notification Extensions

```swift
extension Notification.Name {
    static let lazyContentAvailable = Notification.Name("AirborneLazyContentAvailable")
    static let allLazyContentAvailable = Notification.Name("AirborneAllLazyContentAvailable")
    static let airborneBootComplete = Notification.Name("AirborneBootComplete")
}

// Usage in your view controllers
NotificationCenter.default.addObserver(
    forName: .lazyContentAvailable,
    object: nil,
    queue: .main
) { notification in
    if let url = notification.userInfo?["url"] as? String {
        print("New content available: \(url)")
        // Update UI
    }
}
```

## Troubleshooting

### Common Issues

#### 1. SDK Not Found

**Error**: `No such module 'Airborne'`

**Solution**:
```bash
cd ios
pod deintegrate
pod install
cd ..
```

For SPM:
- File → Packages → Reset Package Caches
- Clean Build Folder (Cmd+Shift+K)
- Rebuild

#### 2. Boot Never Completes

**Problem**: `startApp` delegate method never called

**Solution**:
- Check network connectivity
- Verify release configuration URL is accessible
- Check Xcode console for error messages
- Test with bundled assets first:
  ```swift
  // Add test config to main bundle
  // Bundle: release-config.json
  ```

#### 3. Bundle Not Loading

**Problem**: App shows blank screen or old content

**Solution**:
- Verify `getIndexBundlePath()` returns a valid path
- Check file exists: `FileManager.default.fileExists(atPath: path)`
- Ensure `startApp` is called before loading UI
- Check bundle file is not corrupted

#### 4. Build Errors

**Error**: Various compilation errors

**Solution**:
```bash
# Clean everything
cd ios
rm -rf Pods
rm Podfile.lock
pod install

# Clean Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Rebuild
xcodebuild clean
xcodebuild build
```

#### 5. Thread Sanitizer Warnings

**Warning**: Data race warnings

**Solution**: All Airborne methods are thread-safe. If you see warnings, ensure you're not caching delegate method results without synchronization.

### Debug Logging

Enable detailed logging:

```swift
// In AppDelegate
func onEvent(level: String, label: String, key: String, value: [String: Any], 
             category: String, subcategory: String) {
    
    let logMessage = """
    🔍 Airborne Event
    Level: \(level)
    Label: \(label)
    Key: \(key)
    Value: \(value)
    Category: \(category)/\(subcategory)
    """
    
    print(logMessage)
    
    // Write to file for later analysis
    Logger.shared.log(logMessage)
}
```

### Testing with Charles Proxy

1. Configure Charles to intercept HTTPS
2. Add your server domain to SSL Proxying
3. Monitor release configuration requests
4. Verify dimensions are sent as headers

## Examples

### SwiftUI Integration

```swift
import SwiftUI
import Airborne

@main
struct MyApp: App {
    @StateObject private var airborneManager = AirborneManager()
    
    var body: some Scene {
        WindowGroup {
            if airborneManager.isReady {
                ContentView()
                    .environmentObject(airborneManager)
            } else {
                SplashView()
            }
        }
    }
}

class AirborneManager: ObservableObject {
    @Published var isReady = false
    @Published var bundleURL: URL?
    @Published var config: [String: Any]?
    
    private var airborne: AirborneServices?
    
    init() {
        setupAirborne()
    }
    
    private func setupAirborne() {
        airborne = AirborneServices(
            releaseConfigURL: Configuration.releaseURL,
            delegate: self
        )
    }
}

extension AirborneManager: AirborneDelegate {
    func namespace() -> String {
        return "com.myapp.production"
    }
    
    func startApp(indexBundleURL: URL?) {
        DispatchQueue.main.async {
            self.bundleURL = indexBundleURL
            self.isReady = true
            
            if let configJSON = self.airborne?.getReleaseConfig(),
               let data = configJSON.data(using: .utf8),
               let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                self.config = config
            }
        }
    }
    
    func dimensions() -> [String: String] {
        return [
            "platform": "ios",
            "appVersion": Bundle.main.appVersion,
            "iosVersion": UIDevice.current.systemVersion
        ]
    }
}
```

### Feature Flags with Airborne

```swift
class FeatureFlagManager {
    static let shared = FeatureFlagManager()
    
    private var flags: [String: Any] = [:]
    private var airborne: AirborneServices?
    
    func loadFlags(from airborne: AirborneServices) {
        self.airborne = airborne
        
        guard let content = airborne.getFileContent(filePath: "config/features.json"),
              let data = content.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            loadDefaultFlags()
            return
        }
        
        self.flags = json
    }
    
    func isEnabled(_ feature: String) -> Bool {
        return flags[feature] as? Bool ?? false
    }
    
    func value<T>(for key: String, default defaultValue: T) -> T {
        return flags[key] as? T ?? defaultValue
    }
    
    private func loadDefaultFlags() {
        // Fallback flags
        flags = [
            "enableNewUI": false,
            "maxUploadSize": 10485760,
            "enableBetaFeatures": false
        ]
    }
}

// Usage
if FeatureFlagManager.shared.isEnabled("enableNewUI") {
    // Show new UI
}

let maxSize = FeatureFlagManager.shared.value(for: "maxUploadSize", default: 10485760)
```

## Next Steps

- [Set up the Airborne Server](../airborne_server/Setup.md)
- [Use the CLI to deploy updates](../airborne_cli/README.md)
- [Integrate with React Native](./React_Native.md)
- [See Android SDK documentation](./Android.md)

## Additional Resources

- **GitHub Repository**: [juspay/airborne](https://github.com/juspay/airborne)
- **Example Apps**: Check the `Example/` directory in the iOS SDK
- **API Documentation**: Generated from source code comments

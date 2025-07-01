# Airborne Native Initialization Guide

This guide explains how to initialize Airborne in native code and use it from React Native. The implementation is compatible with both the old and new React Native architectures.

## Overview

Airborne is initialized once in native code (iOS/Android) when the app starts. After initialization, the React Native module can access the Airborne instance to read config files and perform other operations.

## Android Setup

### 1. Add Airborne maven

In your root's `android/build.gradle`:

```gradle
allprojects {
    repositories {
        maven { url "https://maven.juspay.in/hyper-sdk/" }
        // ... other mavens
    }
}
```


### 2. Initialize Airborne in MainApplication

In your `MainApplication.kt` (or `.java`), initialize Airborne in the `onCreate` method and override `getJSBundleFile` method of `ReactNativeHost` adnd return `airborneInstance.getBundlePath()` from there.

```kotlin
import android.app.Application
import `in`.juspay.airborneplugin.Airborne
import `in`.juspay.airborneplugin.AirborneInterface
import `in`.juspay.airborne.LazyDownloadCallback

class MainApplication : Application(), ReactApplication {

    private lateinit var airborneInstance: Airborne
    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {

            override fun getJSBundleFile(): String? {
                return airborneInstance.getBundlePath()
            }
            // Other overridden methods
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()

        // Initialize Airborne before React Native
        initializeAirborne()

        // Rest of your code in onCreate
    }

    private fun initializeAirborne() {
        try {
            airborneInstance = Airborne(
                this.applicationContext,
                "https://example.com/airborne/release-config",
                object : AirborneInterface() {
                    override fun getNamespace(): String {
                        return "example-new" // return your app's package name or some identifier of your app.
                    }

                    override fun getDimensions(): HashMap<String, String> {
                        val map = HashMap<String, String>()
                        map.put("city", "bangalore")
                        return map
                    }

                    override fun getIndexBundlePath(): String {
                        return "index.android.bundle" // return your react app's bundled index file name.
                    }

                    override fun getLazyDownloadCallback(): LazyDownloadCallback {
                        return object : LazyDownloadCallback {
                            override fun fileInstalled(filePath: String, success: Boolean) {
                                // Logic
                            }

                            override fun lazySplitsInstalled(success: Boolean) {
                                // Logic
                            }
                        }
                    }

                    override fun onBootComplete() {
                        super.onBootComplete()
                    }

                    override fun onEvent(
                        level: String,
                        label: String,
                        key: String,
                        value: JSONObject,
                        category: String,
                        subCategory: String
                    ) {
                        // Logic to process ota events, for logging/analytics purpose.
                    }
                })
            Log.i("Airborne", "Airborne initialized successfully")
        } catch (e: Exception) {
            Log.e("Airborne", "Failed to initialize Airborne", e)
        }
    }
}
```

## iOS Setup

### 1. Initialize Airborne in AppDelegate

In your `AppDelegate.swift` (or `.m`), initialize Airborne:

```swift
import UIKit
import react_native_hyperota

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // Initialize Airborne
        Hyperota.initializeAirborne(
            withAppId: "your-app-id",
            indexFileName: "main.jsbundle",
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0",
            releaseConfigTemplateUrl: "https://your-server.com/release-config",
            headers: [
                "Authorization": "Bearer your-token",
                "X-Custom-Header": "value"
            ]
        )

        // Rest of your initialization code...
        return true
    }
}
```

For Objective-C:

```objc
#import "AppDelegate.h"
#import <react_native_hyperota/react_native_hyperota-Swift.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {

    // Initialize Airborne
    [Hyperota initializeAirborneWithAppId:@"your-app-id"
                            indexFileName:@"main.jsbundle"
                               appVersion:[[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"]
                  releaseConfigTemplateUrl:@"https://your-server.com/release-config"
                                  headers:@{
                                      @"Authorization": @"Bearer your-token",
                                      @"X-Custom-Header": @"value"
                                  }];

    // Rest of your initialization code...
    return YES;
}

@end
```

### 2. Add Airborne SDK

Add the Airborne iOS SDK to your project. You can use CocoaPods, Carthage, or Swift Package Manager.

For CocoaPods, add to your `Podfile`:

```ruby
pod 'Airborne', '~> YOUR_VERSION'
```

## React Native Usage

After native initialization, you can use Airborne in your React Native code:

```typescript
import { readReleaseConfig, getFileContent, getBundlePath } from 'airborne-react-native';

// Read release configuration
const config = await readReleaseConfig();
console.log('Release config:', JSON.parse(config));

// Get file content from OTA bundle
const content = await getFileContent('path/to/file.json');
console.log('File content:', content);

// Get bundle path
const bundlePath = await getBundlePath();
console.log('Bundle path:', bundlePath);
```

## Architecture Compatibility

This implementation is compatible with both:

1. **Old Architecture**: Uses the traditional React Native bridge
2. **New Architecture (TurboModules)**: Uses the new TurboModule system with JSI

The module automatically detects which architecture is being used and loads the appropriate implementation.

## Error Handling

All methods return promises that can be rejected with error codes:

- `AIRBORNE_ERROR`: General Airborne errors
- `HYPER_OTA_NOT_INIT`: Airborne is not initialized (shouldn't happen if initialized in native code)

```typescript
try {
    const config = await readReleaseConfig();
    // Use config
} catch (error) {
    console.error('Failed to read config:', error.message);
}
```

## Important Notes

1. **Native Instance**: The Airborne instance should be created and managed in native code. React Native only accesses this instance, it doesn't create its own.

2. **Thread Safety**: The implementation is thread-safe on both platforms.

3. **Callbacks**: The lazy download and onEvent should be handled in native code. You can expose these to React Native if needed by adding event emitters.

## Troubleshooting

1. **Module not found**: Make sure you've rebuilt the app after adding the native code
2. **Airborne not initialized**: Ensure the initialization code runs before any React Native code tries to use the module
3. **Build errors**: Check that you've added the Airborne SDK dependencies correctly
4. **Compatibility**: Please use node 20, java 17 to run the example apps.

## Future Enhancements

1. Handle the actual callbacks and events from the SDK
2. Add more methods as needed for your use case

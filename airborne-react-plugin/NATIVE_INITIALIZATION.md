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

In your `MainApplication.kt` (or `.java`), initialize Airborne in the `onCreate` method.
And extend the `AirborneReactNativeHost` and assign it to the `ReactNativeHost`'s object in your `MainApplication` and override `getJSBundleFile` method of `AirborneReactNativeHost` and return `airborne.getBundlePath()` from there.

```kotlin
import android.app.Application
import `in`.juspay.airborneplugin.Airborne
import `in`.juspay.airborneplugin.AirborneInterface
import `in`.juspay.airborne.LazyDownloadCallback
import `in`.juspay.airborneplugin.AirborneReactNativeHost

class MainApplication : Application(), ReactApplication {

    private var bundlePath: String? = null
    var isBootComplete = false
    var bootCompleteListener: (() -> Unit)? = null
    private lateinit var airborne: Airborne
    override val reactNativeHost: ReactNativeHost =
        object : AirborneReactNativeHost(this@MainApplication) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Packages that cannot be autolinked yet can be added manually here, for example:
                    // add(MyReactNativePackage())
                }

            override fun getJSBundleFile(): String? {
                // This is delayed until mainActivity is created.
                // Make sure react is not booted until after bundlePath is created
                return airborne.getBundlePath()
            }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = AirborneReactNativeHost.getReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()

        // Initialize Airborne
        try {
            airborne = Airborne(
                this.applicationContext,
                "https://airborne.sandbox.juspay.in/release/airborne-react-example/android",
                object : AirborneInterface() {

                    override fun getNamespace(): String {
                        return "airborne-example" // Your app id
                    }

                    override fun getDimensions(): HashMap<String, String> {
                        val map = HashMap<String, String>()
                        map.put("city", "bangalore")
                        return map
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

                    override fun onEvent(
                        level: String,
                        label: String,
                        key: String,
                        value: JSONObject,
                        category: String,
                        subCategory: String
                    ) {
                        // Log the event
                    }

                    override fun startApp(indexPath: String) {
                        isBootComplete = true
                        bundlePath = indexPath
                        bootCompleteListener?.invoke()
                    }
                })
            Log.i("Airborne", "Airborne initialized successfully")
        } catch (e: Exception) {
            Log.e("Airborne", "Failed to initialize Airborne", e)
        }

        SoLoader.init(this, OpenSourceMergedSoMapping)
    }
}

```

### 3. Use AirborneReactActivityDelegate in MainActivity
Return instance of AirborneReactActivityDelegate in the createReactActivityDelegate function.

```kotlin
import `in`.juspay.airborneplugin.AirborneReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "AirborneExample"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      AirborneReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
```

### Note: If your app has a native SplashActivity.
If your app has a native `SplashActivity` before the `ReactActivity(MainActivity)` then you can listen to the `startApp` callback from the `AirborneInterface` to start the `ReactActivity`, In this case you have to listen to the `startApp` function from the `MainApplication` and start the `MainActivity` as shown in the below code snippet.
Note that this step is applicable only if your has a splash activity in native.
```kotlin
class SplashActivity : AppCompatActivity() {
    var hasBootCompleted = false
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.splash_screen)

        if (applicationContext is MainApplication) {
            (applicationContext as MainApplication).bootCompleteListener = {
                startMainActivity()
            }
            if ((applicationContext as MainApplication).isBootComplete) {
                startMainActivity()
            }
        }
    }

    private fun startMainActivity() {
        synchronized(this) {
            if (hasBootCompleted) return
            hasBootCompleted = true
        }
        startActivity(Intent(this, MainActivity::class.java))
        finish()
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
const config = await readReleaseConfig(namespace/appId);
console.log('Release config:', JSON.parse(config));

// Get file content from OTA bundle
const content = await getFileContent(namespace/appId, 'path/to/file.json');
console.log('File content:', content);

// Get bundle path
const bundlePath = await getBundlePath(namespace/appId);
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
    const config = await readReleaseConfig(namespace/appId);
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

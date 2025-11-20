# Airborne React Native Integration Guide

Complete guide for integrating Airborne OTA updates into React Native applications.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Architecture Support](#architecture-support)
- [Android Setup](#android-setup)
- [iOS Setup](#ios-setup)
- [JavaScript/TypeScript API](#javascripttypescript-api)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Overview

The `airborne-react-native` package provides a React Native module that:

1. ✅ Initializes Airborne in native code (iOS/Android) during app startup
2. ✅ Exposes React Native methods to access the native Airborne instance
3. ✅ Is compatible with both old (Bridge) and new (TurboModules/JSI) React Native architectures
4. ✅ Manages OTA bundle downloads and updates seamlessly

### Key Features

- **Native Initialization**: Airborne initializes before React Native boots
- **Architecture Agnostic**: Works with both React Native architectures automatically
- **Thread-Safe**: All operations are safe for concurrent access
- **Type-Safe**: Full TypeScript support with type definitions
- **Fallback Support**: Automatic fallback to bundled assets if OTA fails

## Installation

### 1. Install the Package

```bash
npm install airborne-react-native
# or
yarn add airborne-react-native
```

### 2. Link Native Dependencies

For React Native 0.60+, autolinking handles this automatically. For older versions:

```bash
npx react-native link airborne-react-native
```

### 3. Install Pods (iOS only)

```bash
cd ios && pod install && cd ..
```

## Architecture Support

The SDK automatically detects and uses the appropriate implementation:

| Architecture | Module Type | Notes |
|--------------|-------------|-------|
| **Old Architecture** | Bridge Module (`AirborneModule`) | Traditional React Native bridge |
| **New Architecture** | TurboModule (`AirborneTurboModule`) | JSI-based, better performance |

No configuration needed - the SDK handles detection automatically.

## Android Setup

### 1. Add Airborne Maven Repository

In your project's root `android/build.gradle`:

```gradle
allprojects {
    repositories {
        maven { url "https://maven.juspay.in/hyper-sdk/" }
        // ... other repositories
    }
}
```

### 2. Update MainApplication

Extend `AirborneReactNativeHost` and initialize Airborne in your `MainApplication.kt`:

```kotlin
import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.soloader.SoLoader
import `in`.juspay.airborne.LazyDownloadCallback
import `in`.juspay.airborneplugin.Airborne
import `in`.juspay.airborneplugin.AirborneInterface
import `in`.juspay.airborneplugin.AirborneReactNativeHost
import org.json.JSONObject

class MainApplication : Application(), ReactApplication {

    private var bundlePath: String? = null
    var isBootComplete = false
    var bootCompleteListener: (() -> Unit)? = null
    private lateinit var airborne: Airborne

    override val reactNativeHost: ReactNativeHost =
        object : AirborneReactNativeHost(this@MainApplication) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Add packages that cannot be autolinked
                }

            override fun getJSBundleFile(): String? {
                // Return the OTA bundle path from Airborne
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

        // Initialize Airborne SDK
        try {
            airborne = Airborne(
                this.applicationContext,
                "https://your-airborne-server.com/release/your-namespace/android",
                object : AirborneInterface() {

                    override fun getNamespace(): String {
                        return "your-app-namespace" // Your unique app identifier
                    }

                    override fun getDimensions(): HashMap<String, String> {
                        val dimensions = HashMap<String, String>()
                        dimensions["city"] = "bangalore"
                        dimensions["userType"] = "premium"
                        // Add your custom dimensions
                        return dimensions
                    }

                    override fun getLazyDownloadCallback(): LazyDownloadCallback {
                        return object : LazyDownloadCallback {
                            override fun fileInstalled(filePath: String, success: Boolean) {
                                Log.i("Airborne", "Lazy file installed: $filePath, success: $success")
                            }

                            override fun lazySplitsInstalled(success: Boolean) {
                                Log.i("Airborne", "All lazy splits installed, success: $success")
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
                        Log.d("Airborne", "Event: $level - $label - $key")
                        // Send to your analytics system
                    }

                    override fun startApp(indexPath: String) {
                        isBootComplete = true
                        bundlePath = indexPath
                        Log.i("Airborne", "Airborne boot complete, bundle path: $indexPath")
                        bootCompleteListener?.invoke()
                    }
                })
            Log.i("Airborne", "Airborne initialized successfully")
        } catch (e: Exception) {
            Log.e("Airborne", "Failed to initialize Airborne", e)
        }

        SoLoader.init(this, false)
    }
}
```

### 3. Update MainActivity

Use `AirborneReactActivityDelegate` in your `MainActivity.kt`:

```kotlin
import `in`.juspay.airborneplugin.AirborneReactActivityDelegate
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate

class MainActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript.
     */
    override fun getMainComponentName(): String = "YourAppName"

    /**
     * Returns the instance of the ReactActivityDelegate.
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        AirborneReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
```

### 4. (Optional) Handle Native Splash Screen

If your app has a native splash screen activity before the React Activity:

```kotlin
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {
    private var hasBootCompleted = false

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

### 1. Install CocoaPods Dependencies

The Airborne iOS SDK will be automatically installed via CocoaPods:

```bash
cd ios && pod install && cd ..
```

### 2. Update AppDelegate

Initialize Airborne in your `AppDelegate.swift`:

```swift
import UIKit
import Airborne

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    private var airborne: AirborneServices?
    private var bridge: RCTBridge?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        
        // Initialize Airborne
        airborne = Airborne(
            releaseConfigURL: "https://your-airborne-server.com/release/your-namespace/ios",
            delegate: self
        )
        
        return true
    }
    
    func sourceURL(for bridge: RCTBridge) -> URL? {
        self.bridge = bridge
        #if DEBUG
        return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        #else
        // Return the OTA bundle URL from Airborne
        return airborne?.getIndexBundleURL()
        #endif
    }
}

// MARK: - AirborneDelegate

extension AppDelegate: AirborneDelegate {
    
    func namespace() -> String {
        return "your-app-namespace" // Your unique app identifier
    }
    
    func dimensions() -> [String: String] {
        return [
            "city": "bangalore",
            "userType": "premium"
        ]
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
    
    func onEvent(
        level: String,
        label: String,
        key: String,
        value: [String: Any],
        category: String,
        subcategory: String
    ) {
        print("Airborne event: \(level) - \(label) - \(key)")
        // Send to your analytics system
    }
    
    func startApp(indexBundleURL: URL?) {
        print("Airborne boot complete, bundle URL: \(String(describing: indexBundleURL))")
        // Trigger React Native to reload with the new bundle if needed
        if let bridge = self.bridge {
            DispatchQueue.main.async {
                bridge.reload()
            }
        }
    }
}
```

For Objective-C projects, see the example implementation in the repository.

## JavaScript/TypeScript API

### Import the Module

```typescript
import {
  readReleaseConfig,
  getFileContent,
  getBundlePath
} from 'airborne-react-native';
```

### API Methods

#### `readReleaseConfig(namespace: string): Promise<string>`

Reads the release configuration for the given namespace/app ID.

**Returns**: JSON string containing the release configuration

```typescript
try {
  const configString = await readReleaseConfig('your-app-namespace');
  const config = JSON.parse(configString);
  console.log('Release config:', config);
  console.log('App version:', config.app_version);
  console.log('Available packages:', config.packages);
} catch (error) {
  console.error('Failed to read config:', error);
}
```

#### `getFileContent(namespace: string, filePath: string): Promise<string>`

Reads content from a file in the OTA bundle.

**Parameters**:
- `namespace`: Your app namespace/ID
- `filePath`: Relative path to the file within the OTA bundle

**Returns**: File content as a string

```typescript
try {
  const content = await getFileContent('your-app-namespace', 'config/features.json');
  const features = JSON.parse(content);
  console.log('Feature flags:', features);
} catch (error) {
  console.error('Failed to read file:', error);
}
```

#### `getBundlePath(namespace: string): Promise<string>`

Returns the file system path to the JavaScript bundle being used.

**Returns**: Absolute file path to the bundle

```typescript
try {
  const bundlePath = await getBundlePath('your-app-namespace');
  console.log('Current bundle path:', bundlePath);
  
  // Check if using OTA bundle
  const isOTA = bundlePath.includes('/airborne/');
  console.log('Using OTA bundle:', isOTA);
} catch (error) {
  console.error('Failed to get bundle path:', error);
}
```

### TypeScript Types

```typescript
interface AirborneModule {
  readReleaseConfig(namespace: string): Promise<string>;
  getFileContent(namespace: string, filePath: string): Promise<string>;
  getBundlePath(namespace: string): Promise<string>;
}

interface ReleaseConfig {
  app_version: string;
  packages: Package[];
  boot_timeout_ms: number;
  release_timeout_ms: number;
  // ... additional fields
}
```

## Configuration

### Release Configuration URL Format

```
https://your-server.com/release/{namespace}/{platform}
```

**Example**:
```
https://airborne.example.com/release/myapp-prod/android
https://airborne.example.com/release/myapp-prod/ios
```

### Namespace Naming Best Practices

- Use reverse domain notation: `com.company.appname`
- Separate environments: `com.company.appname.production`, `com.company.appname.staging`
- Keep it unique across your organization

### Dimensions

Dimensions allow you to serve different configurations to different user segments:

```kotlin
// Android
override fun getDimensions(): HashMap<String, String> {
    return hashMapOf(
        "city" to getUserCity(),
        "userType" to if (isPremiumUser()) "premium" else "free",
        "appVersion" to BuildConfig.VERSION_NAME,
        "deviceType" to if (isTablet()) "tablet" else "phone"
    )
}
```

```swift
// iOS
func dimensions() -> [String: String] {
    return [
        "city": getUserCity(),
        "userType": isPremiumUser() ? "premium" : "free",
        "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
        "deviceType": UIDevice.current.userInterfaceIdiom == .pad ? "tablet" : "phone"
    ]
}
```

## Testing

### Testing with Example App

The repository includes a complete example app:

```bash
# Clone the repository
git clone https://github.com/juspay/airborne.git
cd airborne/airborne-react-native/example

# Install dependencies
npm install
cd ios && pod install && cd ..

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Testing OTA Updates

1. **Start the Airborne Server** (see [Server Setup Guide](../airborne_server/Setup.md))

2. **Create and deploy an update**:
   ```bash
   # Build your bundle
   npx react-native bundle --platform android --dev false --entry-file index.js \
     --bundle-output android/app/build/generated/assets/react/release/index.android.bundle

   # Deploy using CLI
   cd path/to/airborne_cli
   node src/index.js create-remote-files -p android --upload
   node src/index.js create-remote-package -p android
   ```

3. **Test the update**:
   - Restart your app
   - Airborne will check for updates on startup
   - The new bundle will be downloaded and used

### Debug Logging

**Android**: Check Logcat for `Airborne` tags
```bash
adb logcat | grep Airborne
```

**iOS**: Check Xcode console for Airborne logs

## Troubleshooting

### Common Issues

#### 1. Module Not Found

**Error**: `Cannot find module 'airborne-react-native'`

**Solution**:
```bash
# Clear caches and reinstall
rm -rf node_modules
npm install
cd ios && pod install && cd ..

# Clear build folders
cd android && ./gradlew clean && cd ..
```

#### 2. Native Module Null

**Error**: `NativeModule.AirborneModule is null`

**Solution**: 
- Ensure you've rebuilt the app after installing
- Verify autolinking is working: `npx react-native config`
- Check that Airborne is initialized in native code before React Native loads

#### 3. Bundle Not Loading

**Error**: App shows blank screen or old content

**Solution**:
- Verify the release configuration URL is correct
- Check network connectivity
- Ensure the server is running and accessible
- Check native logs for Airborne errors
- Verify `getJSBundleFile()` (Android) or `sourceURL(for:)` (iOS) returns the correct path

#### 4. Build Errors

**Android**:
```bash
cd android && ./gradlew clean build
```

**iOS**:
```bash
cd ios && pod deintegrate && pod install && cd ..
```

#### 5. TurboModule Registration Failed (New Architecture)

**Solution**:
- Ensure you're using React Native 0.70+
- Verify `newArchEnabled` is set correctly in gradle.properties
- Rebuild with: `cd android && ./gradlew clean && cd .. && npm run android`

### Compatibility Requirements

| Component | Version |
|-----------|---------|
| React Native | 0.70+ |
| Node.js | 20+ |
| Java/JDK | 17+ |
| Xcode | 14+ |
| iOS Deployment Target | 12.0+ |
| Android Min SDK | 21 |
| Android Target SDK | 35 |

### Getting Detailed Logs

**Android**:
```kotlin
Log.setLogLevel(Log.VERBOSE)
```

**iOS**:
```swift
// Add to AppDelegate
os_log(.debug, log: OSLog.default, "Airborne: detailed message")
```

## Examples

### Complete React Native Component

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import {
  readReleaseConfig,
  getFileContent,
  getBundlePath
} from 'airborne-react-native';

const NAMESPACE = 'your-app-namespace';

function App() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAirborneData();
  }, []);

  const loadAirborneData = async () => {
    try {
      setLoading(true);
      
      // Get release config
      const configStr = await readReleaseConfig(NAMESPACE);
      const releaseConfig = JSON.parse(configStr);
      setConfig(releaseConfig);
      
      // Get bundle path
      const bundlePath = await getBundlePath(NAMESPACE);
      console.log('Bundle path:', bundlePath);
      
      // Read a custom config file
      const customConfig = await getFileContent(NAMESPACE, 'config.json');
      console.log('Custom config:', customConfig);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Airborne error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Loading Airborne configuration...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', marginBottom: 20 }}>Error: {error}</Text>
        <Button title="Retry" onPress={loadAirborneData} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>
        Airborne OTA Active ✓
      </Text>
      {config && (
        <>
          <Text>App Version: {config.app_version}</Text>
          <Text>Packages: {config.packages?.length || 0}</Text>
          <Text>Boot Timeout: {config.boot_timeout_ms}ms</Text>
        </>
      )}
      <Button title="Reload Config" onPress={loadAirborneData} style={{ marginTop: 20 }} />
    </View>
  );
}

export default App;
```

### Feature Flags with OTA

```typescript
import { getFileContent } from 'airborne-react-native';

interface FeatureFlags {
  enableNewUI: boolean;
  enableBetaFeatures: boolean;
  maxUploadSize: number;
}

async function loadFeatureFlags(namespace: string): Promise<FeatureFlags> {
  try {
    const content = await getFileContent(namespace, 'features.json');
    return JSON.parse(content);
  } catch (error) {
    // Fallback to default flags
    return {
      enableNewUI: false,
      enableBetaFeatures: false,
      maxUploadSize: 10485760 // 10MB
    };
  }
}

// Usage
const flags = await loadFeatureFlags('your-app-namespace');
if (flags.enableNewUI) {
  // Show new UI
}
```

## Next Steps

- [Set up the Airborne Server](../airborne_server/Setup.md)
- [Use the CLI to create updates](../airborne_cli/README.md)
- [Explore the example apps](../../airborne-react-native/example)
- [Read the Android SDK documentation](./Android.md)
- [Read the iOS SDK documentation](./iOS.md)

## Additional Resources

- **GitHub Repository**: [juspay/airborne](https://github.com/juspay/airborne)
- **Example Apps**: 
  - [New Architecture Example](../../airborne-react-native/example)
  - [Old Architecture Example](../../airborne-react-native/ExampleOldArch)
  - [Split Bundle Example](../../airborne-react-native/ExampleSplitBundle)

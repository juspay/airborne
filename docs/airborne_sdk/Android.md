# Airborne Android SDK Integration Guide

Complete guide for integrating Airborne OTA updates into native Android applications.

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

The Airborne Android SDK provides Over-The-Air (OTA) update capabilities for Android applications. It enables you to:

- 📦 Download and manage application updates without Google Play Store
- 🚀 Load JavaScript bundles dynamically (for hybrid apps)
- 🎯 Serve different content based on user dimensions
- 💾 Cache downloaded assets for offline use
- 🔄 Implement lazy loading for non-critical resources
- 📊 Track update lifecycle events

### Key Features

- **Kotlin-First**: Written in modern Kotlin with Java interop
- **Thread-Safe**: All operations are thread-safe by default
- **Modular Architecture**: Workspace management, OTA services, and application management are separated
- **Flexible Configuration**: Support for release configurations via URL or bundled assets
- **Event Tracking**: Comprehensive event system for monitoring and analytics

## Installation

### Add Maven Repository

Add the Airborne maven repository to your project's root `build.gradle`:

```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url "https://maven.juspay.in/hyper-sdk/" }
    }
}
```

### Add Dependency

Add the Airborne SDK dependency in your app's `build.gradle`:

```gradle
dependencies {
    implementation 'io.juspay:airborne:0.15.1' // Check for latest version
}
```

### Update Gradle Properties

Ensure your `gradle.properties` includes:

```properties
android.useAndroidX=true
android.enableJetifier=true
```

### Minimum Requirements

```gradle
android {
    compileSdk 35
    
    defaultConfig {
        minSdk 21      // Android 5.0
        targetSdk 35   // Android 15
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
    
    kotlinOptions {
        jvmTarget = "1.8"
    }
}
```

## Quick Start

### Basic Implementation

```kotlin
import android.app.Application
import android.util.Log
import `in`.juspay.airborne.HyperOTAServices
import `in`.juspay.airborne.TrackerCallback
import `in`.juspay.airborne.LazyDownloadCallback
import org.json.JSONObject

class MyApplication : Application() {
    
    private lateinit var hyperOTA: HyperOTAServices
    private var bundlePath: String? = null
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize Airborne
        val workspacePath = filesDir.absolutePath + "/airborne"
        val appVersion = "1.0.0"
        val releaseConfigUrl = "https://your-server.com/release/your-namespace/android"
        
        hyperOTA = HyperOTAServices(
            context = applicationContext,
            workSpacePath = workspacePath,
            appVersion = appVersion,
            releaseConfigTemplateUrl = releaseConfigUrl,
            trackerCallback = createTrackerCallback(),
            onBootComplete = { indexPath ->
                Log.i("Airborne", "Boot complete, bundle: $indexPath")
                bundlePath = indexPath
                // Start your app here
            },
            useBundledAssets = false // Set to true for testing with bundled assets
        )
        
        // Create Application Manager and start
        val dimensions = mapOf(
            "city" to "bangalore",
            "userType" to "premium"
        )
        
        val appManager = hyperOTA.createApplicationManager(
            dimensions = dimensions,
            metricsEndpoint = "https://your-server.com/metrics" // Optional
        )
        
        // Start the application manager
        appManager.start(createLazyDownloadCallback())
    }
    
    private fun createTrackerCallback(): TrackerCallback {
        return object : TrackerCallback {
            override fun logEvent(
                level: String,
                label: String,
                key: String,
                value: JSONObject,
                category: String,
                subCategory: String
            ) {
                Log.d("Airborne", "Event: $level - $key - $value")
                // Send to your analytics system
            }
        }
    }
    
    private fun createLazyDownloadCallback(): LazyDownloadCallback {
        return object : LazyDownloadCallback {
            override fun fileInstalled(filePath: String, success: Boolean) {
                Log.i("Airborne", "File installed: $filePath, success: $success")
            }
            
            override fun lazySplitsInstalled(success: Boolean) {
                Log.i("Airborne", "Lazy splits installed: $success")
            }
        }
    }
    
    fun getBundlePath(): String? = bundlePath
}
```

## Core Components

### 1. HyperOTAServices

The main entry point for the SDK. Manages workspace and OTA services.

```kotlin
class HyperOTAServices(
    context: Context,
    workSpacePath: String,              // Where to store OTA files
    appVersion: String,                  // Your app version
    releaseConfigTemplateUrl: String,    // URL to fetch release config
    trackerCallback: TrackerCallback,    // Event tracking callback
    onBootComplete: ((String) -> Unit)?, // Called when boot completes
    useBundledAssets: Boolean = false,   // Use bundled assets for testing
    fromAirborne: Boolean = true         // Internal flag
)
```

**Methods**:
- `createApplicationManager(dimensions, metricsEndpoint): ApplicationManager` - Creates an application manager instance

### 2. ApplicationManager

Manages the application lifecycle and OTA updates.

```kotlin
val appManager = hyperOTA.createApplicationManager(
    dimensions = mapOf("city" to "bangalore"),
    metricsEndpoint = "https://your-server.com/metrics"
)

appManager.start(lazyDownloadCallback)
```

**Methods**:
- `start(callback: LazyDownloadCallback)` - Starts the OTA process
- `readConfig(namespace: String): String?` - Reads release config JSON
- `getFileContent(namespace: String, path: String): String?` - Reads file content
- `getBundlePath(namespace: String): String?` - Gets bundle file path

### 3. Workspace

Manages file system operations for OTA content.

```kotlin
val workspace = hyperOTA.workspace

// Access workspace properties
val workspacePath = workspace.workSpacePath
val rootPath = workspace.rootPath
```

### 4. TrackerCallback

Interface for receiving lifecycle events.

```kotlin
interface TrackerCallback {
    fun logEvent(
        level: String,      // "info", "error", "warning"
        label: String,      // Event label
        key: String,        // Event key/name
        value: JSONObject,  // Event data
        category: String,   // Event category
        subCategory: String // Event subcategory
    )
}
```

### 5. LazyDownloadCallback

Interface for lazy download progress.

```kotlin
interface LazyDownloadCallback {
    fun fileInstalled(filePath: String, success: Boolean)
    fun lazySplitsInstalled(success: Boolean)
}
```

## Integration Steps

### Step 1: Set Up Application Class

Create or update your `Application` class:

```kotlin
import android.app.Application
import `in`.juspay.airborne.HyperOTAServices
import `in`.juspay.airborne.TrackerCallback
import `in`.juspay.airborne.LazyDownloadCallback

class MyApplication : Application() {
    
    companion object {
        private var instance: MyApplication? = null
        
        fun getInstance(): MyApplication? = instance
    }
    
    private lateinit var hyperOTA: HyperOTAServices
    private var bundlePath: String? = null
    var isBootComplete = false
    
    override fun onCreate() {
        super.onCreate()
        instance = this
        
        initializeAirborne()
    }
    
    private fun initializeAirborne() {
        val workspacePath = filesDir.absolutePath + "/airborne"
        val appVersion = BuildConfig.VERSION_NAME
        val releaseConfigUrl = getString(R.string.airborne_release_url)
        
        try {
            hyperOTA = HyperOTAServices(
                context = applicationContext,
                workSpacePath = workspacePath,
                appVersion = appVersion,
                releaseConfigTemplateUrl = releaseConfigUrl,
                trackerCallback = AirborneTracker(),
                onBootComplete = { indexPath ->
                    bundlePath = indexPath
                    isBootComplete = true
                    onAirborneReady()
                }
            )
            
            val appManager = hyperOTA.createApplicationManager(
                dimensions = getDimensions()
            )
            
            appManager.start(AirborneLazyCallback())
            
        } catch (e: Exception) {
            Log.e("Airborne", "Failed to initialize", e)
        }
    }
    
    private fun getDimensions(): Map<String, String> {
        return mapOf(
            "city" to getCityFromLocation(),
            "appVersion" to BuildConfig.VERSION_NAME,
            "buildType" to BuildConfig.BUILD_TYPE,
            "userType" to if (isPremiumUser()) "premium" else "free"
        )
    }
    
    private fun onAirborneReady() {
        // Notify activities or start main activity
    }
    
    fun getBundlePath(): String? = bundlePath
    
    fun getHyperOTA(): HyperOTAServices = hyperOTA
}
```

### Step 2: Declare Application Class in Manifest

```xml
<application
    android:name=".MyApplication"
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:theme="@style/AppTheme">
    
    <activity android:name=".MainActivity">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
    </activity>
</application>
```

### Step 3: Create Tracker Implementation

```kotlin
import `in`.juspay.airborne.TrackerCallback
import org.json.JSONObject

class AirborneTracker : TrackerCallback {
    override fun logEvent(
        level: String,
        label: String,
        key: String,
        value: JSONObject,
        category: String,
        subCategory: String
    ) {
        when (level) {
            "error" -> Log.e("Airborne", "$key: $value")
            "warning" -> Log.w("Airborne", "$key: $value")
            else -> Log.i("Airborne", "$key: $value")
        }
        
        // Send to analytics
        when (key) {
            "download_started" -> trackDownloadStarted(value)
            "download_completed" -> trackDownloadCompleted(value)
            "download_failed" -> trackDownloadFailed(value)
            "boot_completed" -> trackBootCompleted(value)
        }
    }
    
    private fun trackDownloadStarted(data: JSONObject) {
        // Firebase, Mixpanel, etc.
    }
    
    private fun trackDownloadCompleted(data: JSONObject) {
        // Analytics implementation
    }
    
    private fun trackDownloadFailed(data: JSONObject) {
        // Error tracking
    }
    
    private fun trackBootCompleted(data: JSONObject) {
        // Success tracking
    }
}
```

### Step 4: Create Lazy Download Handler

```kotlin
import `in`.juspay.airborne.LazyDownloadCallback

class AirborneLazyCallback : LazyDownloadCallback {
    override fun fileInstalled(filePath: String, success: Boolean) {
        if (success) {
            Log.i("Airborne", "Lazy file ready: $filePath")
            // Notify UI that additional content is available
        } else {
            Log.w("Airborne", "Lazy file failed: $filePath")
        }
    }
    
    override fun lazySplitsInstalled(success: Boolean) {
        if (success) {
            Log.i("Airborne", "All lazy content installed")
            // Show notification or update UI
        }
    }
}
```

### Step 5: Handle Splash Screen (Optional)

If you have a splash screen, wait for Airborne to be ready:

```kotlin
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)
        
        val app = application as? MyApplication
        
        if (app?.isBootComplete == true) {
            startMainActivity()
        } else {
            // Wait for boot complete
            // You can implement a listener pattern here
            checkBootStatus()
        }
    }
    
    private fun checkBootStatus() {
        // Poll or use LiveData/Flow to wait for boot
        handler.postDelayed({
            val app = application as? MyApplication
            if (app?.isBootComplete == true) {
                startMainActivity()
            } else {
                checkBootStatus()
            }
        }, 100)
    }
    
    private fun startMainActivity() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
```

## API Reference

### Reading Release Configuration

```kotlin
val app = application as MyApplication
val hyperOTA = app.getHyperOTA()
val appManager = hyperOTA.createApplicationManager(dimensions)

// Read the release config
val configJson = appManager.readConfig("your-namespace")
configJson?.let {
    val config = JSONObject(it)
    val version = config.getString("app_version")
    val packages = config.getJSONArray("packages")
}
```

### Reading File Content

```kotlin
// Read a file from the OTA bundle
val content = appManager.getFileContent("your-namespace", "config/features.json")
content?.let {
    val features = JSONObject(it)
    val enableNewUI = features.getBoolean("enableNewUI")
}
```

### Getting Bundle Path

```kotlin
val bundlePath = appManager.getBundlePath("your-namespace")
bundlePath?.let {
    // Use the bundle path
    Log.i("Airborne", "Bundle located at: $it")
}
```

### Checking OTA Status

```kotlin
val app = application as MyApplication
if (app.isBootComplete) {
    // Airborne is ready, can start app
} else {
    // Still loading, show splash or loading screen
}
```

## Configuration

### Release Configuration URL

The release configuration URL should follow this format:

```
https://your-server.com/release/{namespace}/{platform}
```

Example:
```kotlin
val releaseConfigUrl = "https://airborne.example.com/release/com.mycompany.myapp/android"
```

### Workspace Path

The workspace path is where Airborne stores downloaded files:

```kotlin
val workspacePath = context.filesDir.absolutePath + "/airborne"
// Results in: /data/user/0/com.mycompany.myapp/files/airborne
```

You can customize this location:

```kotlin
val workspacePath = context.getExternalFilesDir(null)?.absolutePath + "/ota"
```

### Dimensions

Dimensions allow you to serve different content based on various criteria:

```kotlin
private fun getDimensions(): Map<String, String> {
    return mapOf(
        // User segmentation
        "userType" to if (user.isPremium) "premium" else "free",
        "userId" to user.id,
        
        // App information
        "appVersion" to BuildConfig.VERSION_NAME,
        "buildType" to BuildConfig.BUILD_TYPE,
        
        // Device information
        "deviceType" to if (isTablet()) "tablet" else "phone",
        "androidVersion" to Build.VERSION.RELEASE,
        "manufacturer" to Build.MANUFACTURER,
        
        // Location
        "city" to getUserCity(),
        "country" to Locale.getDefault().country,
        
        // Feature flags
        "betaFeatures" to preferences.getBoolean("beta_features", false).toString(),
        
        // Custom dimensions
        "experimentGroup" to getExperimentGroup()
    )
}
```

### Bundled Assets (Development/Testing)

For development or testing without a server:

```kotlin
HyperOTAServices(
    // ... other params
    useBundledAssets = true  // Use assets from assets/ folder
)
```

Place your test release configuration in `assets/release-config.json`.

## Advanced Features

### ProGuard/R8 Configuration

Add to your `proguard-rules.pro`:

```proguard
# Airborne SDK
-keep class in.juspay.airborne.** { *; }
-keep interface in.juspay.airborne.** { *; }

# Keep callback interfaces
-keep class * implements in.juspay.airborne.TrackerCallback { *; }
-keep class * implements in.juspay.airborne.LazyDownloadCallback { *; }

# Keep data classes used in callbacks
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
```

### Network Configuration

Add to `res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">your-airborne-server.com</domain>
    </domain-config>
</network-security-config>
```

Reference it in `AndroidManifest.xml`:

```xml
<application
    android:networkSecurityConfig="@xml/network_security_config">
    <!-- ... -->
</application>
```

### Custom HTTP Headers

You can add custom headers through dimensions, which are sent as HTTP headers:

```kotlin
val dimensions = mapOf(
    "Authorization" to "Bearer $token",
    "X-Custom-Header" to "value"
)
```

### Metrics Endpoint

Optionally specify a metrics endpoint for analytics:

```kotlin
val appManager = hyperOTA.createApplicationManager(
    dimensions = dimensions,
    metricsEndpoint = "https://your-server.com/api/metrics"
)
```

### Handling Updates in Background

```kotlin
class UpdateService : Service() {
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        CoroutineScope(Dispatchers.IO).launch {
            checkForUpdates()
        }
        return START_NOT_STICKY
    }
    
    private suspend fun checkForUpdates() {
        // Trigger Airborne update check
        // This can be done periodically
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
}
```

## Troubleshooting

### Common Issues

#### 1. SDK Not Found

**Error**: `Could not find io.juspay:airborne:x.x.x`

**Solution**:
```gradle
// Ensure maven repository is added
allprojects {
    repositories {
        maven { url "https://maven.juspay.in/hyper-sdk/" }
    }
}
```

#### 2. Class Not Found at Runtime

**Error**: `ClassNotFoundException: in.juspay.airborne.HyperOTAServices`

**Solution**:
- Check ProGuard/R8 rules
- Ensure dependency is in `implementation`, not `compileOnly`
- Clean and rebuild: `./gradlew clean build`

#### 3. Boot Never Completes

**Problem**: `onBootComplete` callback never called

**Solution**:
- Check network connectivity
- Verify release configuration URL is accessible
- Check logcat for error messages
- Ensure server is running and returning valid JSON
- Try with `useBundledAssets = true` to test locally

#### 4. File Not Found Errors

**Problem**: Cannot read files from OTA bundle

**Solution**:
- Verify the file path is correct (relative to bundle root)
- Ensure the file was included in the package
- Check that boot has completed before reading files

#### 5. Memory Issues

**Problem**: OutOfMemoryError when downloading large files

**Solution**:
- Increase heap size in `AndroidManifest.xml`:
```xml
<application android:largeHeap="true">
```
- Split large files into smaller chunks
- Use lazy loading for non-critical content

### Debug Logging

Enable verbose logging:

```kotlin
import android.util.Log

// Set log level
if (BuildConfig.DEBUG) {
    Log.setDebug()
}

// Detailed tracker callback
class DebugTracker : TrackerCallback {
    override fun logEvent(
        level: String,
        label: String,
        key: String,
        value: JSONObject,
        category: String,
        subCategory: String
    ) {
        val message = """
            Level: $level
            Label: $label
            Key: $key
            Value: $value
            Category: $category
            SubCategory: $subCategory
        """.trimIndent()
        
        Log.d("Airborne-Debug", message)
    }
}
```

### Logcat Filtering

```bash
# View all Airborne logs
adb logcat | grep Airborne

# View only errors
adb logcat | grep "E/Airborne"

# View specific component
adb logcat | grep "HyperOTAServices"
```

## Examples

### Complete Implementation with LiveData

```kotlin
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

class AirborneManager(private val context: Context) {
    
    private val _bootStatus = MutableLiveData<BootStatus>()
    val bootStatus: LiveData<BootStatus> = _bootStatus
    
    private val _downloadProgress = MutableLiveData<Int>()
    val downloadProgress: LiveData<Int> = _downloadProgress
    
    private lateinit var hyperOTA: HyperOTAServices
    
    fun initialize() {
        _bootStatus.value = BootStatus.Initializing
        
        try {
            hyperOTA = HyperOTAServices(
                context = context,
                workSpacePath = context.filesDir.absolutePath + "/airborne",
                appVersion = BuildConfig.VERSION_NAME,
                releaseConfigTemplateUrl = getServerUrl(),
                trackerCallback = createTracker(),
                onBootComplete = { path ->
                    _bootStatus.postValue(BootStatus.Complete(path))
                }
            )
            
            val appManager = hyperOTA.createApplicationManager(
                dimensions = getDimensions()
            )
            
            appManager.start(createLazyCallback())
            
        } catch (e: Exception) {
            _bootStatus.value = BootStatus.Error(e.message ?: "Unknown error")
        }
    }
    
    private fun createTracker() = object : TrackerCallback {
        override fun logEvent(
            level: String, label: String, key: String,
            value: JSONObject, category: String, subCategory: String
        ) {
            when (key) {
                "download_progress" -> {
                    val progress = value.optInt("progress", 0)
                    _downloadProgress.postValue(progress)
                }
                "download_failed" -> {
                    _bootStatus.postValue(BootStatus.Error("Download failed"))
                }
            }
        }
    }
    
    private fun createLazyCallback() = object : LazyDownloadCallback {
        override fun fileInstalled(filePath: String, success: Boolean) {
            Log.i("Airborne", "Lazy file: $filePath, success: $success")
        }
        
        override fun lazySplitsInstalled(success: Boolean) {
            Log.i("Airborne", "All lazy content installed: $success")
        }
    }
    
    sealed class BootStatus {
        object Initializing : BootStatus()
        data class Complete(val bundlePath: String) : BootStatus()
        data class Error(val message: String) : BootStatus()
    }
}
```

### Using in Activity

```kotlin
class MainActivity : AppCompatActivity() {
    
    private lateinit var airborneManager: AirborneManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        val app = application as MyApplication
        airborneManager = AirborneManager(app)
        
        airborneManager.bootStatus.observe(this) { status ->
            when (status) {
                is AirborneManager.BootStatus.Initializing -> {
                    showLoading()
                }
                is AirborneManager.BootStatus.Complete -> {
                    hideLoading()
                    startApp(status.bundlePath)
                }
                is AirborneManager.BootStatus.Error -> {
                    showError(status.message)
                }
            }
        }
        
        airborneManager.downloadProgress.observe(this) { progress ->
            updateProgress(progress)
        }
    }
}
```

## Next Steps

- [Set up the Airborne Server](../airborne_server/Setup.md)
- [Use the CLI to deploy updates](../airborne_cli/README.md)
- [Integrate with React Native](./React_Native.md)
- [See iOS SDK documentation](./iOS.md)

## Additional Resources

- **GitHub Repository**: [juspay/airborne](https://github.com/juspay/airborne)
- **Maven Repository**: [https://maven.juspay.in/hyper-sdk/](https://maven.juspay.in/hyper-sdk/)
- **API Documentation**: See source code javadocs

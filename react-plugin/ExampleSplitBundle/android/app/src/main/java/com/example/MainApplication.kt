package com.example

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactContext
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.ReactInstanceManager.ReactInstanceEventListener
import com.facebook.react.bridge.JSBundleLoader
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import `in`.juspay.airborneplugin.Airborne
import `in`.juspay.airborneplugin.AirborneInterface
import org.json.JSONObject

class MainApplication : Application(), ReactApplication {
    private var bundlePath: String? = null
    var isBootComplete = false
    var bootCompleteListener: (() -> Unit)? = null
    private lateinit var airborneInstance: Airborne

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getUseDeveloperSupport(): Boolean = false
            override fun getJSMainModuleName(): String = "index"

            override fun getJSBundleFile(): String? {
                // Use Airborne bundle path when available, otherwise fall back to assets
                return if (::airborneInstance.isInitialized) {
                    airborneInstance.getBundlePath()
                } else {
                    Log.d("MainApplication", "Airborne not initialized, using default bundle path")
                    "assets://index.bundle.android"
                }
            }

            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()

        // Initialize Airborne before React Native
        initializeAirborne()

        loadReactNative(this)

        reactNativeHost.reactInstanceManager
            .addReactInstanceEventListener(object : ReactInstanceEventListener {
                override fun onReactContextInitialized(reactContext: ReactContext) {
                    val loader = JSBundleLoader.createAssetLoader(
                        applicationContext,
                        "assets://business.bundle.android",
                        /* lazy: */ false
                    )
                    loader.loadScript(reactContext.catalystInstance)
                }
            })
    }

    private fun initializeAirborne() {
        try {
            airborneInstance = Airborne(
                this.applicationContext,
                "https://airborne.sandbox.juspay.in/release/airborne-react-example/android",
                object : AirborneInterface() {
                    override fun getNamespace(): String {
                        return "examplesplitbundle"
                    }

                    override fun getDimensions(): HashMap<String, String> {
                        val map = HashMap<String, String>()
//                        map["split_bundle"] = "true"
                        return map
                    }

                    override fun getIndexBundlePath(): String {
                        return "index.bundle.android"
                    }

                    override fun onBootComplete(indexPath: String) {
                        isBootComplete = true
                        bundlePath = indexPath
                        Log.d("Airborne", "Boot complete with bundle path: $indexPath")
                        bootCompleteListener?.invoke()
                    }

                    override fun onEvent(
                        level: String,
                        label: String,
                        key: String,
                        value: JSONObject,
                        category: String,
                        subCategory: String
                    ) {
                        Log.d("Airborne", "Event: $level - $label - $key - $value")
                    }
                })
            Log.i("Airborne", "Airborne initialized successfully")
        } catch (e: Exception) {
            Log.e("Airborne", "Failed to initialize Airborne", e)
        }
    }
}

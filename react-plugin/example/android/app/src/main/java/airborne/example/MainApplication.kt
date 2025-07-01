package airborne.example

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import `in`.juspay.airborneplugin.Airborne
import `in`.juspay.airborneplugin.AirborneInterface
import `in`.juspay.airborne.LazyDownloadCallback
import org.json.JSONObject

class MainApplication : Application(), ReactApplication {

    private lateinit var airborneInstance: Airborne
    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Packages that cannot be autolinked yet can be added manually here, for example:
                    // add(MyReactNativePackage())
                }

            override fun getJSBundleFile(): String? {
                return airborneInstance.getBundlePath()
            }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()

        // Initialize Airborne before React Native
        initializeAirborne()

        SoLoader.init(this, OpenSourceMergedSoMapping)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            // If you opted-in for the New Architecture, we load the native entry point for this app.
            load()
        }
    }

    private fun initializeAirborne() {
        try {
            airborneInstance = Airborne(
                this.applicationContext,
                "https://example.com/airborne/release-config",
                object : AirborneInterface() {
                    override fun getNamespace(): String {
                        return "example-new"
                    }

                    override fun getDimensions(): HashMap<String, String> {
                        val map = HashMap<String, String>()
                        map.put("city", "bangalore")
                        return map
                    }

                    override fun getIndexBundlePath(): String {
                        return "index.android.bundle"
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
                })
            Log.i("Airborne", "Airborne initialized successfully")
        } catch (e: Exception) {
            Log.e("Airborne", "Failed to initialize Airborne", e)
        }
    }
}

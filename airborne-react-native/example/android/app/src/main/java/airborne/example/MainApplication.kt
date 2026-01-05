package airborne.example

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import `in`.juspay.airborneplugin.Airborne
import `in`.juspay.airborneplugin.AirborneInterface
import `in`.juspay.airborneplugin.AirborneReactNativeHost
import `in`.juspay.airborneplugin.AirborneReactNativeHostBase
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
        get() = AirborneReactNativeHostBase.getReactHost(applicationContext, reactNativeHost)

    /**
     * Initialize application-wide components: configure and start the Airborne SDK and initialize SoLoader.
     *
     * The Airborne configuration registers a callback (`startApp`) that marks the application boot as complete,
     * stores the provided JS bundle path in `bundlePath`, and invokes `bootCompleteListener` if present.
     */
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
                        return map
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
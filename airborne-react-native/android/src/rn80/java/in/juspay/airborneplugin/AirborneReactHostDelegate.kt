package `in`.juspay.airborneplugin

import android.content.Context
import android.util.Log
import com.facebook.react.JSEngineResolutionAlgorithm
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactPackageTurboModuleManagerDelegate
import com.facebook.react.bridge.JSBundleLoader
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.defaults.DefaultTurboModuleManagerDelegate
import com.facebook.react.runtime.BindingsInstaller
import com.facebook.react.runtime.JSCInstance
import com.facebook.react.runtime.JSRuntimeFactory
import com.facebook.react.runtime.ReactHostDelegate
import com.facebook.react.runtime.hermes.HermesInstance
import java.lang.ref.WeakReference

@OptIn(UnstableReactNativeAPI::class)
class AirborneReactHostDelegate(
    private val context: Context,
    private val reactNativeHostWrapper: ReactNativeHost,
    override val bindingsInstaller: BindingsInstaller? = null,
    override val turboModuleManagerDelegateBuilder: ReactPackageTurboModuleManagerDelegate.Builder =
        DefaultTurboModuleManagerDelegate.Builder()
) : ReactHostDelegate {

    override val jsBundleLoader: JSBundleLoader
        get() {
            val bundleName = (reactNativeHostWrapper as? AirborneReactNativeHost)?.jsBundleFile
            bundleName?.let {
                return if (bundleName.startsWith("assets://")) {
                    JSBundleLoader.createAssetLoader(
                        context,
                        bundleName,
                        false
                    )
                } else {
                    JSBundleLoader.createFileLoader(bundleName)
                }
            }
            return JSBundleLoader.createAssetLoader(
                context,
                "assets://index.android.bundle",
                false
            )
        }

    override val jsMainModulePath: String
        get() = (reactNativeHostWrapper as? AirborneReactNativeHost)?.jsMainModuleName ?: "index"

    override val jsRuntimeFactory: JSRuntimeFactory
        get() = if ((reactNativeHostWrapper as? AirborneReactNativeHost)?.jsEngineResolutionAlgorithm == JSEngineResolutionAlgorithm.HERMES) {
            HermesInstance()
        } else {
            JSCInstance()
        }

    override val reactPackages: List<ReactPackage>
        get() = (reactNativeHostWrapper as? AirborneReactNativeHost)?.packages ?: emptyList()

    /**
     * Called by React Native when the instance fails (bundle load, reload or a fatal JS error)
     * while dev support is disabled, so no RedBox is shown. Logs the error and reports it through
     * [Airborne.trackReactInstanceException] to the [Airborne] instance whose bundle this host
     * loaded.
     *
     * @param error the failure React Native reported.
     */
    override fun handleInstanceException(error: Exception) {
        Log.e(TAG, "React instance exception", error)
        val bundlePath = try {
            (reactNativeHostWrapper as? AirborneReactNativeHost)?.jsBundleFile
        } catch (_: Exception) {
            null
        }
        Airborne.trackReactInstanceException(error, bundlePath)
    }

    companion object {
        private const val TAG = "AirborneReactHostDelegate"
    }
}

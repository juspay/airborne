package `in`.juspay.airborneplugin

import android.content.Context
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactPackageTurboModuleManagerDelegate
import com.facebook.react.bridge.JSBundleLoader
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.defaults.DefaultTurboModuleManagerDelegate
import com.facebook.react.runtime.BindingsInstaller
import com.facebook.react.runtime.JSRuntimeFactory
import com.facebook.react.runtime.ReactHostDelegate
import com.facebook.react.runtime.hermes.HermesInstance

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
        get() = HermesInstance()

    override val reactPackages: List<ReactPackage>
        get() = (reactNativeHostWrapper as? AirborneReactNativeHost)?.packages ?: emptyList()

    override fun handleInstanceException(error: Exception) {
    }
}

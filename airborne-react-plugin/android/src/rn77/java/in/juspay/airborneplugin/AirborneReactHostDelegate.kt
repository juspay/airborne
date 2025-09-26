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
import com.facebook.react.fabric.ReactNativeConfig
import com.facebook.react.runtime.BindingsInstaller
import com.facebook.react.runtime.JSCInstance
import com.facebook.react.runtime.JSRuntimeFactory
import com.facebook.react.runtime.ReactHostDelegate
import com.facebook.react.runtime.hermes.HermesInstance
import java.lang.ref.WeakReference

@OptIn(UnstableReactNativeAPI::class)
class AirborneReactHostDelegate(
    private val weakContext: WeakReference<Context>,
    private val reactNativeHostWrapper: ReactNativeHost,
    override val bindingsInstaller: BindingsInstaller? = null,
    private val reactNativeConfig: ReactNativeConfig = ReactNativeConfig.DEFAULT_CONFIG,
    override val turboModuleManagerDelegateBuilder: ReactPackageTurboModuleManagerDelegate.Builder =
        DefaultTurboModuleManagerDelegate.Builder()
) : ReactHostDelegate {

    override val jsBundleLoader: JSBundleLoader
        get() {
            val bundleName =
                (reactNativeHostWrapper as AirborneReactNativeHost).jsBundleFile
            bundleName?.let {
                return if (bundleName.startsWith("assets://")) {
                    JSBundleLoader.createAssetLoader(
                        weakContext.get(),
                        bundleName,
                        false
                    )
                } else {
                    JSBundleLoader.createFileLoader(bundleName)
                }
            }
            return JSBundleLoader.createAssetLoader(
                weakContext.get(),
                "assets://index.android.bundle",
                false
            )
        }

    override val jsMainModulePath: String
        get() = (reactNativeHostWrapper as AirborneReactNativeHost).jsMainModuleName

    override val jsRuntimeFactory: JSRuntimeFactory
        get() = if ((reactNativeHostWrapper as AirborneReactNativeHost).jsEngineResolutionAlgorithm == JSEngineResolutionAlgorithm.HERMES) {
            HermesInstance()
        } else {
            JSCInstance()
        }

    override val reactPackages: List<ReactPackage>
        get() = (reactNativeHostWrapper as AirborneReactNativeHost).packages

    override fun getReactNativeConfig(): ReactNativeConfig {
        return reactNativeConfig
    }

    override fun handleInstanceException(error: Exception) {
    }
}

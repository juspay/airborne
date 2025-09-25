package `in`.juspay.airborneplugin

import android.app.Application
import android.content.Context
import android.util.Log
import com.facebook.react.JSEngineResolutionAlgorithm
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.JSExceptionHandler
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.defaults.DefaultComponentsRegistry
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.fabric.ComponentFactory
import com.facebook.react.runtime.ReactHostImpl
import java.lang.ref.WeakReference

abstract class AirborneReactNativeHost(application: Application) :
    DefaultReactNativeHost(application) {

    public override fun getPackages(): List<ReactPackage> {
        return this.packages
    }

    public override fun getJSBundleFile(): String? {
        return super.getJSBundleFile()
    }

    public override fun getJSEngineResolutionAlgorithm(): JSEngineResolutionAlgorithm? {
        return super.getJSEngineResolutionAlgorithm()
    }

    public override fun getJSMainModuleName(): String {
        return super.getJSMainModuleName()
    }

    companion object {
        @OptIn(UnstableReactNativeAPI::class)
        fun getReactHost(context: Context, reactNativeHost: ReactNativeHost): ReactHost {
            val reactHostDelegate =
                AirborneReactHostDelegate(WeakReference(context), reactNativeHost)
            val componentFactory = ComponentFactory()
            DefaultComponentsRegistry.register(componentFactory)
            val reactHostImpl =
                ReactHostImpl(context, reactHostDelegate, componentFactory, true, true)
            return reactHostImpl
        }
    }
}

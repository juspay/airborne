package `in`.juspay.airborneplugin

import android.app.Application
import android.content.Context
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.defaults.DefaultComponentsRegistry
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.fabric.ComponentFactory
import com.facebook.react.runtime.ReactHostImpl
import java.lang.ref.WeakReference

abstract class AirborneReactNativeHostBase(application: Application) :
    DefaultReactNativeHost(application) {

    /**
     * Retrieves the list of React packages configured for this host.
     *
     * @return The current list of `ReactPackage` instances used by this host.
     */
    public override fun getPackages(): List<ReactPackage> {
        return this.packages
    }

    /**
     * Provides the file system path of the JavaScript bundle used by this React Native host, or `null` if no bundle is configured.
     *
     * @return The path to the JS bundle file, or `null` when no bundle is set.
     */
    public override fun getJSBundleFile(): String? {
        return super.getJSBundleFile()
    }

    /**
     * Provides the name of the JavaScript main module to load.
     *
     * @return The main module name (for example, "index").
     */
    public override fun getJSMainModuleName(): String {
        return super.getJSMainModuleName()
    }

    companion object {
        /**
         * Creates a ReactHost configured for the given context and ReactNativeHost.
         *
         * @param context Android Context used to construct the host and delegate.
         * @param reactNativeHost The ReactNativeHost forwarded to the host delegate.
         * @return A configured ReactHost instance.
         */
        @OptIn(UnstableReactNativeAPI::class)
        fun getReactHost(context: Context, reactNativeHost: ReactNativeHost): ReactHost {
            val reactHostDelegate =
                AirborneReactHostDelegate(context, reactNativeHost)
            val componentFactory = ComponentFactory()
            DefaultComponentsRegistry.register(componentFactory)
            val reactHostImpl =
                ReactHostImpl(context, reactHostDelegate, componentFactory, true, true)
            return reactHostImpl
        }
    }
}
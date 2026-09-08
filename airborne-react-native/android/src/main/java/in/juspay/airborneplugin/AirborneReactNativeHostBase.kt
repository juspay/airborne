package `in`.juspay.airborneplugin

import android.app.Application
import android.content.Context
import android.util.Log
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.common.build.ReactBuildConfig
import com.facebook.react.defaults.DefaultComponentsRegistry
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.fabric.ComponentFactory
import com.facebook.react.runtime.ReactHostImpl
import java.lang.ref.WeakReference

abstract class AirborneReactNativeHostBase(application: Application) :
    DefaultReactNativeHost(application) {

    public override fun getPackages(): List<ReactPackage> {
        return this.packages
    }

    public override fun getJSBundleFile(): String? {
        return super.getJSBundleFile()
    }

    public override fun getJSMainModuleName(): String {
        return super.getJSMainModuleName()
    }

    companion object {
        /**
         * Builds a [ReactHost] wired to Airborne's [AirborneReactHostDelegate].
         *
         * Dev support (Metro, dev menu, fast refresh) follows [reactNativeHost]'s
         * [ReactNativeHost.getUseDeveloperSupport], exactly like React Native's
         * DefaultReactNativeHost, and falls back to [ReactBuildConfig.DEBUG] if that override throws.
         *
         * @param context the application context.
         * @param reactNativeHost the app's [ReactNativeHost], normally an [AirborneReactNativeHost].
         * @return a [ReactHost] to return from `ReactApplication.reactHost`.
         */
        @OptIn(UnstableReactNativeAPI::class)
        fun getReactHost(context: Context, reactNativeHost: ReactNativeHost): ReactHost {
            val reactHostDelegate =
                AirborneReactHostDelegate(context, reactNativeHost)
            val componentFactory = ComponentFactory()
            DefaultComponentsRegistry.register(componentFactory)
            // Dev support (Metro, dev menu, fast refresh) follows the host app's own
            // getUseDeveloperSupport(), exactly like React Native's DefaultReactNativeHost.
            val useDevSupport = try {
                reactNativeHost.getUseDeveloperSupport()
            } catch (e: Exception) {
                Log.e(TAG, "getUseDeveloperSupport() failed, falling back to ReactBuildConfig.DEBUG", e)
                ReactBuildConfig.DEBUG
            }
            val reactHostImpl =
                ReactHostImpl(context, reactHostDelegate, componentFactory, true, useDevSupport)
            return reactHostImpl
        }

        private const val TAG = "AirborneReactNativeHost"
    }
}

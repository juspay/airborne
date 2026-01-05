package `in`.juspay.airborneplugin

import android.app.Application
import com.facebook.react.JSEngineResolutionAlgorithm
import com.facebook.react.defaults.DefaultReactNativeHost

abstract class AirborneReactNativeHost(application: Application) :
    AirborneReactNativeHostBase(application) {
    /**
     * Provides the JavaScript engine resolution algorithm used by the React Native host.
     *
     * @return The configured JSEngineResolutionAlgorithm, or `null` if none is specified.
     */
    override fun getJSEngineResolutionAlgorithm(): JSEngineResolutionAlgorithm? {
        return super.getJSEngineResolutionAlgorithm()
    }
}
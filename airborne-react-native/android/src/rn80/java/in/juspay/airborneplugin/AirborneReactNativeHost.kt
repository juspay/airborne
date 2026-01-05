package `in`.juspay.airborneplugin

import android.app.Application
import com.facebook.react.JSEngineResolutionAlgorithm

abstract class AirborneReactNativeHost(application: Application) :
    AirborneReactNativeHostBase(application) {
    /**
     * Provide the JavaScript engine resolution algorithm for this React Native host.
     *
     * @return The configured [JSEngineResolutionAlgorithm], or `null` if none is available.
     */
    public override fun getJSEngineResolutionAlgorithm(): JSEngineResolutionAlgorithm? {
        return super.getJSEngineResolutionAlgorithm()
    }
}
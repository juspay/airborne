package `in`.juspay.airborneplugin

import android.app.Application
import com.facebook.react.JSEngineResolutionAlgorithm
import com.facebook.react.defaults.DefaultReactNativeHost

abstract class AirborneReactNativeHost(application: Application) :
    AirborneReactNativeHostBase(application) {
    override fun getJSEngineResolutionAlgorithm(): JSEngineResolutionAlgorithm? {
        return super.getJSEngineResolutionAlgorithm()
    }
}

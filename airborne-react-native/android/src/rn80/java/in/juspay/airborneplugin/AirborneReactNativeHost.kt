package `in`.juspay.airborneplugin

import android.app.Application
import com.facebook.react.JSEngineResolutionAlgorithm

abstract class AirborneReactNativeHost(application: Application) :
    AirborneReactNativeHostBase(application) {
    public override fun getJSEngineResolutionAlgorithm(): JSEngineResolutionAlgorithm? {
        return super.getJSEngineResolutionAlgorithm()
    }
}

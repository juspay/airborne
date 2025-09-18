package `in`.juspay.airborneplugin

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

class AirbornePackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == AirborneModule.NAME) {
      if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
        AirborneTurboModule(reactContext)
      } else {
        AirborneModule(reactContext)
      }
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      val isTurboModule: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      moduleInfos[AirborneModule.NAME] = ReactModuleInfo(
          AirborneModule.NAME,
        if (isTurboModule) AirborneTurboModule::class.java.name else AirborneModule::class.java.name,
        false,  // canOverrideExistingModule
        false,  // needsEagerInit
        true,   // hasConstants
        false,  // isCxxModule
        isTurboModule // isTurboModule
      )
      moduleInfos
    }
  }
}

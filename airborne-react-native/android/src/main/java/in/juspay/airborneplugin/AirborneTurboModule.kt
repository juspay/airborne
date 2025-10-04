package `in`.juspay.airborneplugin

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = AirborneTurboModule.NAME)
class AirborneTurboModule(reactContext: ReactApplicationContext) :
  NativeAirborneSpec(reactContext) {

  private val implementation = AirborneModuleImpl(reactContext)

  override fun getName(): String {
    return NAME
  }

  override fun readReleaseConfig(nameSpace: String, promise: Promise) {
    implementation.readReleaseConfig(nameSpace, promise)
  }

  override fun getFileContent(nameSpace: String, filePath: String, promise: Promise) {
    implementation.getFileContent(nameSpace, filePath, promise)
  }

  override fun getBundlePath(nameSpace: String, promise: Promise) {
    implementation.getBundlePath(nameSpace, promise)
  }

  companion object {
    const val NAME = "AirborneReact"
  }
}

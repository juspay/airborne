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

  override fun readReleaseConfig(promise: Promise) {
    implementation.readReleaseConfig(promise)
  }

  override fun getFileContent(filePath: String, promise: Promise) {
    implementation.getFileContent(filePath, promise)
  }

  override fun getBundlePath(promise: Promise) {
    implementation.getBundlePath(promise)
  }

  companion object {
    const val NAME = "HyperOta"
  }
}

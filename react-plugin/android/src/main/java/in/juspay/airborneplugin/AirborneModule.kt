package `in`.juspay.airborneplugin

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = AirborneModule.NAME)
class AirborneModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val implementation = AirborneModuleImpl(reactContext)

  override fun getName(): String {
    return NAME
  }

  @ReactMethod
  fun readReleaseConfig(promise: Promise) {
    implementation.readReleaseConfig(promise)
  }

  @ReactMethod
  fun getFileContent(filePath: String, promise: Promise) {
    implementation.getFileContent(filePath, promise)
  }

  @ReactMethod
  fun getBundlePath(promise: Promise) {
    implementation.getBundlePath(promise)
  }

  companion object {
    const val NAME = "Airborne"
  }
}

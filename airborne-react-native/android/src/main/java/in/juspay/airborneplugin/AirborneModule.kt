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
  fun readReleaseConfig(namespace: String, promise: Promise) {
    implementation.readReleaseConfig(namespace, promise)
  }

  @ReactMethod
  fun getFileContent(namespace: String, filePath: String, promise: Promise) {
    implementation.getFileContent(namespace, filePath, promise)
  }

  @ReactMethod
  fun getBundlePath(namespace: String, promise: Promise) {
    implementation.getBundlePath(namespace, promise)
  }

  companion object {
    const val NAME = "Airborne"
  }
}

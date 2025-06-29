package `in`.juspay.airborneplugin

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise

/**
 * Implementation class that handles the actual HyperOTA operations.
 * This class is shared between old and new architecture modules.
 */
class AirborneModuleImpl(private val reactContext: ReactApplicationContext) {

    companion object {
//        private var isInitialized = false

//        /**
//         * Initialize HyperOTA from native code (typically from MainApplication)
//         */
//        @JvmStatic
//        fun initializeHyperOTA(
//          context: Context,
//          appId: String,
//          indexFileName: String,
//          appVersion: String,
//          releaseConfigTemplateUrl: String,
//          headers: Map<String, String>? = null,
//          lazyDownloadCallback: LazyDownloadCallback? = null,
//          trackerCallback: TrackerCallback? = null
//        ) {
//            if (!isInitialized) {
//              Airborne.init(
//                context,
//                appId,
//                indexFileName,
//                appVersion,
//                releaseConfigTemplateUrl,
//                headers,
//                lazyDownloadCallback,
//                trackerCallback
//              )
//                isInitialized = true
//            }
//        }
    }

    fun readReleaseConfig(promise: Promise) {
        try {
            val config = Airborne.instance.getReleaseConfig()
            promise.resolve(config)
        } catch (e: Exception) {
            promise.reject("HYPER_OTA_ERROR", "Failed to read release config: ${e.message}", e)
        }
    }

    fun getFileContent(filePath: String, promise: Promise) {
        try {
            val content = Airborne.instance.getFileContent(filePath)
            promise.resolve(content)
        } catch (e: Exception) {
            promise.reject("HYPER_OTA_ERROR", "Failed to read file content: ${e.message}", e)
        }
    }

    fun getBundlePath(promise: Promise) {
        try {
            val path = Airborne.instance.getBundlePath()
            promise.resolve(path)
        } catch (e: Exception) {
            promise.reject("HYPER_OTA_ERROR", "Failed to get bundle path: ${e.message}", e)
        }
    }
}

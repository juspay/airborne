package `in`.juspay.airborneplugin

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise

/**
 * Implementation class that handles the actual Airborne operations.
 * This class is shared between old and new architecture modules.
 */
class AirborneModuleImpl(private val reactContext: ReactApplicationContext) {

    companion object {
//        private var isInitialized = false

//        /**
//         * Initialize Airborne from native code (typically from MainApplication)
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

    fun readReleaseConfig(namespace: String, promise: Promise) {
        try {
            val config = Airborne.airborneObjectMap[namespace]?.getReleaseConfig()
            promise.resolve(config)
        } catch (e: Exception) {
            promise.reject("AIRBORNE_ERROR", "Failed to read release config: ${e.message}", e)
        }
    }

    fun getFileContent(namespace: String, filePath: String, promise: Promise) {
        try {
            val content = Airborne.airborneObjectMap[namespace]?.getFileContent(filePath)
            promise.resolve(content)
        } catch (e: Exception) {
            promise.reject("AIRBORNE_ERROR", "Failed to read file content: ${e.message}", e)
        }
    }

    fun getBundlePath(namespace: String, promise: Promise) {
        try {
            val path = Airborne.airborneObjectMap[namespace]?.getBundlePath()
            promise.resolve(path)
        } catch (e: Exception) {
            promise.reject("AIRBORNE_ERROR", "Failed to get bundle path: ${e.message}", e)
        }
    }
}

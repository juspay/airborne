package `in`.juspay.airborneplugin

import android.os.Handler
import android.os.Looper
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

    fun checkForUpdate(namespace: String, promise: Promise) {
        Thread {
            try {
                val airborne = Airborne.airborneObjectMap[namespace]
                if (airborne == null) {
                    promise.reject("AIRBORNE_ERROR", "Airborne not initialized for namespace: $namespace")
                    return@Thread
                }
                val result = airborne.checkForUpdate()
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("AIRBORNE_ERROR", "Failed to check for update: ${e.message}", e)
            }
        }.start()
    }

    fun downloadUpdate(namespace: String, promise: Promise) {
        try {
            val airborne = Airborne.airborneObjectMap[namespace]
            if (airborne == null) {
                promise.reject("AIRBORNE_ERROR", "Airborne not initialized for namespace: $namespace")
                return
            }
            airborne.downloadUpdate { success ->
                Handler(Looper.getMainLooper()).post {
                    promise.resolve(success)
                }
            }
        } catch (e: Exception) {
            promise.reject("AIRBORNE_ERROR", "Failed to download update: ${e.message}", e)
        }
    }

    fun startBackgroundDownload(namespace: String, promise: Promise) {
        try {
            Airborne.triggerBackgroundDownload(reactContext.applicationContext, namespace)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AIRBORNE_ERROR", "Failed to start background download: ${e.message}", e)
        }
    }

    fun reloadApp(namespace: String, promise: Promise) {
        try {
            promise.resolve(null)

            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    val context = reactContext.applicationContext
                    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                    if (intent != null) {
                        intent.addFlags(
                            android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                            android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
                        )
                        context.startActivity(intent)
                        reactContext.currentActivity?.finishAffinity()
                        android.os.Process.killProcess(android.os.Process.myPid())
                    }
                } catch (e: Exception) {
                    android.util.Log.e("AirborneModuleImpl", "Failed to reload app", e)
                }
            }, 200)
        } catch (e: Exception) {
            promise.reject("AIRBORNE_ERROR", "Failed to reload app: ${e.message}", e)
        }
    }
}

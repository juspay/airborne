package `in`.juspay.airborneplugin

import android.content.Context
import androidx.annotation.Keep
import `in`.juspay.airborne.HyperOTAServices
import `in`.juspay.airborne.LazyDownloadCallback
import `in`.juspay.airborne.TrackerCallback
import `in`.juspay.hyperutil.constants.LogLevel
import org.json.JSONObject
import `in`.juspay.airborne.ota.OTADownloadWorker
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.X509TrustManager

@Keep
class Airborne(
    context: Context,
    releaseConfigUrl: String,
    private val airborneInterface: AirborneInterface
) {

    constructor(context: Context, releaseConfigUrl: String) : this(context, releaseConfigUrl, object : AirborneInterface() {})

    /**
     * Default no-op TrackerCallback.
     */
    private val trackerCallback = object : TrackerCallback() {

        override fun track(
            category: String,
            subCategory: String,
            level: String,
            label: String,
            key: String,
            value: JSONObject
        ) {
            airborneInterface.onEvent(level, label, key, value, category, subCategory)
        }

        override fun trackException(
            category: String,
            subCategory: String,
            label: String,
            description: String,
            e: Throwable
        ) {
            airborneInterface.onEvent(LogLevel.EXCEPTION, label, description, JSONObject().put("throwable", e), category, subCategory)
        }
    }

    private val hyperOTAServices = HyperOTAServices(
        context,
        airborneInterface.getNamespace(),
        "",
        releaseConfigUrl,
        trackerCallback,
        this::bootComplete
    )

    private val applicationManager = hyperOTAServices.createApplicationManager(airborneInterface.getDimensions())

    init {
        airborneObjectMap[airborneInterface.getNamespace()] = this
        applicationManager.shouldUpdate = airborneInterface.enableBootDownload()
        applicationManager.loadApplication(airborneInterface.getNamespace(), airborneInterface.getLazyDownloadCallback())
        OTADownloadWorker.managerMap[airborneInterface.getNamespace()] = applicationManager
    }

    private fun bootComplete(filePath: String) {
        airborneInterface.startApp(filePath.ifEmpty { "assets://${applicationManager.getBundledIndexPath().ifEmpty { "index.android.bundle" }}" })
    }

    /**
     * @return The path of the index bundle, or asset path fallback if empty.
     */
    @Keep
    fun getBundlePath(): String {
        val filePath = applicationManager.getIndexBundlePath()
        return filePath.ifEmpty { "assets://${applicationManager.getBundledIndexPath().ifEmpty { "index.android.bundle" }}" }
    }

    /**
     * Reads the content of the given file.
     * @param filePath The relative path of the file.
     * @return The content of the file as String.
     */
    @Keep
    fun getFileContent(filePath: String): String {
        return applicationManager.readSplit(filePath)
    }

    /**
     * @return Stringified JSON of the release config.
     */
    @Keep
    fun getReleaseConfig(): String {
        return applicationManager.readReleaseConfig()
    }

    // TODO: Re-enable once setSslConfig is added back to ApplicationManager
    // /**
    //  * Set custom SSL configuration for mTLS support.
    //  * Call this before network requests are made to enable client certificate authentication.
    //  *
    //  * @param sslSocketFactory SSL socket factory configured with client certificate
    //  * @param trustManager Trust manager for server certificate validation
    //  */
    // @Keep
    // fun setSslConfig(sslSocketFactory: SSLSocketFactory, trustManager: X509TrustManager) {
    //     applicationManager.setSslConfig(sslSocketFactory, trustManager)
    // }

    /**
     * Check if an OTA update is available.
     * Delegates to ApplicationManager which handles the network call and version comparison.
     */
    @Keep
    fun checkForUpdate(): String {
        return applicationManager.checkForUpdate()
    }

    /**
     * Download and install the latest OTA bundle.
     * Delegates to ApplicationManager.downloadUpdate() which reuses the same
     * download/install infrastructure as boot-time updates.
     */
    @Keep
    fun downloadUpdate(onComplete: (success: Boolean) -> Unit) {
        applicationManager.downloadUpdate(onComplete = onComplete)
    }

    companion object {
//        private var initializer: (() -> Airborne)? = null
//
//        /**
//         * Lazily initialized singleton instance.
//         */
//        @JvmStatic
//        val instance: Airborne by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
//            initializer?.invoke()
//                ?: throw IllegalStateException("AirborneReact initializer not set. Call init() first.")
//        }
//
//        /**
//         * Initializes the AirborneReact singleton.
//         */
//        @JvmStatic
//        fun init(
//            context: Context,
//            appId: String,
//            indexFileName: String,
//            appVersion: String,
//            releaseConfigTemplateUrl: String,
//            headers: Map<String, String>? = null,
//            lazyDownloadCallback: LazyDownloadCallback? = null,
//            trackerCallback: TrackerCallback? = null
//        ) {
//            initializer = {
//                Airborne(
//                    context,
//                    appId,
//                    indexFileName,
//                    appVersion,
//                    releaseConfigTemplateUrl,
//                    headers,
//                    lazyDownloadCallback ?: defaultLazyCallback,
//                    trackerCallback ?: defaultTrackerCallback
//                )
//            }
//        }

        val airborneObjectMap: MutableMap<String, Airborne> = java.util.concurrent.ConcurrentHashMap()

        /**
         * Default LazyDownloadCallback implementation.
         */
        val defaultLazyCallback = object : LazyDownloadCallback {
            override fun fileInstalled(filePath: String, success: Boolean) {
                // Default implementation: log the file installation status
                if (success) {
                    println("AirborneReact: File installed successfully: $filePath")
                } else {
                    println("AirborneReact: File installation failed: $filePath")
                }
            }

            override fun lazySplitsInstalled(success: Boolean) {
                // Default implementation: log the lazy splits installation status
                if (success) {
                    println("AirborneReact: Lazy splits installed successfully")
                } else {
                    println("AirborneReact: Lazy splits installation failed")
                }
            }
        }

        /**
         * Trigger a background OTA download via WorkManager.
         * Call from FCM service or any context — does not require RN.
         */
        @JvmStatic
        fun triggerBackgroundDownload(context: Context, namespace: String) {
            OTADownloadWorker.enqueue(context, namespace)
        }
    }
}

package `in`.juspay.airborneplugin

import android.content.Context
import androidx.annotation.Keep
import `in`.juspay.airborne.HyperOTAServices
import `in`.juspay.airborne.LazyDownloadCallback
import `in`.juspay.airborne.TrackerCallback
import `in`.juspay.hyperutil.constants.LogLevel
import org.json.JSONObject
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.X509TrustManager

@Keep
class Airborne(
    private val context: Context,
    private val releaseConfigUrl: String,
    private val airborneInterface: AirborneInterface,
    private val shouldUpdate: Boolean
) {

    constructor(context: Context, releaseConfigUrl: String) : this(context, releaseConfigUrl, object : AirborneInterface() {}, true)

    constructor(context: Context, releaseConfigUrl: String, airborneInterface: AirborneInterface) : this(
        context,
        releaseConfigUrl,
        airborneInterface,
        true
    )

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
        airborneObjectMap.put(airborneInterface.getNamespace(), this)
        applicationManager.shouldUpdate = shouldUpdate
        applicationManager.loadApplication(airborneInterface.getNamespace(), airborneInterface.getLazyDownloadCallback())
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

    /**
     * Checks for updates by fetching the remote RC and comparing with local.
     * Uses the dimensions provided via AirborneInterface at init time.
     * @return JSON string with update metadata.
     */
    @Keep
    fun checkForUpdate(): String {
        return applicationManager.checkForUpdate()
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

        public val airborneObjectMap: MutableMap<String, Airborne> = mutableMapOf()

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
    }
}

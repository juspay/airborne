// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package `in`.juspay.airborne.ota

import android.content.Context
import android.util.Log
import `in`.juspay.airborne.LazyDownloadCallback
import `in`.juspay.airborne.network.NetUtils
import `in`.juspay.airborne.network.OTANetUtils
import `in`.juspay.airborne.ota.Constants.CONFIG_FILE_NAME
import `in`.juspay.airborne.ota.Constants.DEFAULT_CONFIG
import `in`.juspay.airborne.ota.Constants.DEFAULT_PKG
import `in`.juspay.airborne.ota.Constants.DEFAULT_RESOURCES
import `in`.juspay.airborne.ota.Constants.PACKAGE_DIR_NAME
import `in`.juspay.airborne.ota.Constants.PACKAGE_MANIFEST_FILE_NAME
import `in`.juspay.airborne.ota.Constants.RC_VERSION_FILE_NAME
import `in`.juspay.airborne.ota.Constants.RESOURCES_DIR_NAME
import `in`.juspay.airborne.ota.Constants.RESOURCES_FILE_NAME
import `in`.juspay.airborne.services.OTAServices
import `in`.juspay.airborne.utils.OTAUtils
import `in`.juspay.airborne.constants.LogCategory
import `in`.juspay.airborne.constants.LogLevel
import `in`.juspay.airborne.constants.LogSubCategory
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap
import java.util.concurrent.Future
import androidx.core.content.edit
import `in`.juspay.airborne.ota.Constants.APP_DIR
import `in`.juspay.airborne.ota.Constants.BACKUPS_DIR

class ApplicationManager(
    private val ctx: Context,
    private var releaseConfigTemplateUrl: String,
    private val otaServices: OTAServices,
    private val metricsEndPoint: String? = null,
    private val rcHeaders: Map<String, String>? = null,
    private val onBootComplete: ((String) -> Unit)? = null,
    private val fromAirborne: Boolean = true
) {
    var shouldUpdate = true
    private lateinit var netUtils: NetUtils
    private var releaseConfig: ReleaseConfig? = null
    private var applicationContent = ""
    private val loadWaitTask = WaitTask()
    private val indexPathWaitTask = WaitTask()
    private val workspace = otaServices.workspace
    private val tracker = otaServices.trackerCallback
    private var indexFolderPath = ""
    private var sessionId: String? = null
    private var rcCallback: ReleaseConfigCallback? = null
    private val packageBackupDir = "$BACKUPS_DIR/${PACKAGE_DIR_NAME}_backup"

    fun loadApplication(
        unSanitizedClientId: String,
        lazyDownloadCallback: LazyDownloadCallback? = null
    ) {
        doAsync {
            otaServices.clientId = unSanitizedClientId
            val clientId = sanitizeClientId(unSanitizedClientId)
            trackInfo("init", JSONObject().put("client_id", clientId))
            val startTime = System.currentTimeMillis()
            try {
                if (releaseConfig == null) {
                    val newRef = WeakReference(ctx)
                    val currentRef = CONTEXT_MAP[clientId]
                    val initialized = if (currentRef == null) {
                        CONTEXT_MAP.putIfAbsent(clientId, newRef) != null
                    } else if (currentRef.get() == null) {
                        !CONTEXT_MAP.replace(clientId, currentRef, newRef)
                    } else {
                        true
                    }
                    val contextRef = CONTEXT_MAP[clientId] ?: newRef
                    releaseConfig = readReleaseConfig(contextRef)
                    if (shouldUpdate) {
                        releaseConfig =
                            tryUpdate(clientId, initialized, contextRef, lazyDownloadCallback)
                    } else {
                        Log.d(TAG, "Updates disabled, running w/o updating.")
                    }
                }
                val rc = releaseConfig!!
                indexFolderPath = getIndexFilePath(rc.pkg.index?.filePath ?: "")
                indexPathWaitTask.complete()
                val js = readSplit(rc.pkg.index?.filePath ?: "")
                if (js.isEmpty()) {
                    throw IllegalStateException("index split is empty.")
                }
                trackBoot(rc, startTime)
                Log.d(TAG, "Loading package version: ${rc.pkg.version}")
                val headerJs = """
                window.document.title="${rc.pkg.name}";
                window.RELEASE_CONFIG=${rc.serialize()};
                """.trimIndent()
                applicationContent = headerJs + js
                loadWaitTask.complete()
            } catch (e: Exception) {
                Log.e(TAG, "Critical exception while loading app! $e")
                trackError(
                    LogLabel.APP_LOAD_EXCEPTION,
                    "Exception raised while loading application.",
                    e
                )
            } finally {
                indexPathWaitTask.complete()
                loadWaitTask.complete()
                onBootComplete?.let { it(indexFolderPath) } // TODO: this has to be changed
                logTimeTaken(startTime, "loadApplication")
            }
        }
    }

    fun getApplicationContent(): String {
        loadWaitTask.get()
        return applicationContent
    }

    fun getIndexBundlePath(): String {
        while (!indexPathWaitTask.isDone) {
            try {
                (ctx as java.lang.Object).wait()
            } catch (e: Exception) {
                // ignore
            }
        }
        return indexFolderPath
    }

    fun setReleaseConfigCallback(rcCallback: ReleaseConfigCallback) {
        this.rcCallback = rcCallback
    }

    fun getBundledIndexPath(): String {
        return releaseConfig?.pkg?.index?.filePath ?: ""
    }

    private fun tryUpdate(
        clientId: String,
        initialized: Boolean,
        fileLock: Any,
        lazyDownloadCallback: LazyDownloadCallback? = null
    ): ReleaseConfig? {
        val startTime = System.currentTimeMillis()
        val url = if (releaseConfigTemplateUrl == "") rcCallback?.getReleaseConfig(false) else releaseConfigTemplateUrl
        netUtils = OTANetUtils(ctx, clientId, otaServices.cleanUpValue)
        netUtils.setTrackMetrics(metricsEndPoint != null)
        val prefs = ctx.getSharedPreferences("hyper_ota_prefs", Context.MODE_PRIVATE)
        val rolledBackVersions = prefs.getStringSet("rolled_back_versions", setOf()) ?: setOf()
        val newTask =
            UpdateTask(
                url ?: releaseConfigTemplateUrl,
                otaServices.fileProviderService,
                releaseConfig,
                rolledBackVersions,
                fileLock,
                tracker,
                netUtils,
                rcHeaders,
                lazyDownloadCallback,
                fromAirborne
            )
        val runningTask = RUNNING_UPDATE_TASKS.putIfAbsent(clientId, newTask) ?: newTask
        if (runningTask == newTask) {
            Log.d(TAG, "No running update tasks for '$clientId', starting new task.")
            val pkg = runningTask.copyTempPkg()
            pkg?.let { p ->
                releaseConfig = releaseConfig?.copy(pkg = p)
                runningTask.updateReleaseConfig(releaseConfig)
            }
            newTask.run { updateResult, persistentState ->
                Log.d(TAG, "Running onFinish for '$clientId'")
                if (!initialized) {
                    runCleanUp(persistentState, updateResult)
                }
                val packageUpdated = when (updateResult) {
                    is UpdateResult.Ok ->
                        updateResult.releaseConfig.pkg.version != releaseConfig?.pkg?.version

                    else -> false
                }
                RUNNING_UPDATE_TASKS.remove(clientId)
                logTimeTaken(startTime, "Update task finished for '$clientId'.")
                postMetrics(newTask.updateUUID, packageUpdated)
            }
        } else {
            Log.d(TAG, "Update task already running for '$clientId'.")
        }
        val uresult = runningTask.await(tracker)
        trackUpdateResult(uresult)
        val rc = when (uresult) {
            is UpdateResult.Ok -> uresult.releaseConfig
            is UpdateResult.PackageUpdateTimeout ->
                uresult.releaseConfig ?: releaseConfig

            UpdateResult.Error.RCFetchError ->
                if (rcCallback != null && rcCallback?.shouldRetry() == true) {
                    Log.d(
                        TAG,
                        "Failed to fetch release config, re-trying in release mode."
                    )
                    runningTask.awaitOnFinish()
                    releaseConfigTemplateUrl = rcCallback?.getReleaseConfig(true) ?: releaseConfigTemplateUrl
                    tryUpdate(clientId, true, fileLock, lazyDownloadCallback)
                } else {
                    releaseConfig
                }

            else -> releaseConfig
        }
        logTimeTaken(startTime, "tryUpdate")
        return rc
    }

    fun setSessionId(sessionId: String?) {
        this.sessionId = sessionId
    }

    private fun postMetrics(updateUUID: String, didUpdatePkg: Boolean) = metricsEndPoint?.let {
        netUtils.postMetrics(it, sessionId ?: "", updateUUID, didUpdatePkg)
    }

    private fun runCleanUp(persistentState: JSONObject, updateResult: UpdateResult) {
        Log.d(TAG, "runCleanUp: updateResult: $updateResult")
        val updatedRc = when (updateResult) {
            is UpdateResult.Ok -> updateResult.releaseConfig
            else -> null
        }
        val pkgSplits = releaseConfig?.pkg?.filePaths ?: emptyList()
        Log.d(TAG, "runCleanUp: Current splits: $pkgSplits")
        val newPkgSplits = updatedRc?.pkg?.filePaths ?: emptyList()
        Log.d(TAG, "runCleanUp: New splits: $newPkgSplits")
        val pkgDir = "app/$PACKAGE_DIR_NAME"
        val resourceFiles =
            releaseConfig?.resources?.filePaths ?: emptyList()
        val newResourceFiles =
            updatedRc?.resources?.filePaths ?: emptyList()
        val splits = if (fromAirborne) {
            pkgSplits + newPkgSplits + resourceFiles + newResourceFiles
        } else {
            (pkgSplits + newPkgSplits)
        }
        cleanUpDir(pkgDir, splits)

        if (!fromAirborne) {
            cleanUpDir("app/$RESOURCES_DIR_NAME", resourceFiles + newResourceFiles)
        }

        val savedPkgDir = persistentState.optJSONObject(StateKey.SAVED_PACKAGE_UPDATE.name)
            ?.optString("dir")
        val savedResDir = persistentState.optJSONObject(StateKey.SAVED_RESOURCE_UPDATE.name)
            ?.optString("dir")
        val cacheDirs = (workspace.cacheRoot.list()?.toList() ?: ArrayList())
            .map { workspace.openInCache(it) }
        val tmpDirRegex = Regex("temp-.*-\\d+")
        val failures = cacheDirs
            .filter {
                it.isDirectory &&
                    it.name != savedPkgDir &&
                    it.name != savedResDir &&
                    it.name.matches(tmpDirRegex)
            }
            .mapNotNull {
                Log.d(TAG, "Deleting temp directory ${it.name}")
                if (!it.deleteRecursively()) {
                    it.name
                } else {
                    null
                }
            }
        if (failures.isNotEmpty()) {
            val message = "Failed to delete some temporary directories during clean-up."
            trackError(
                LogLabel.CLEAN_UP_ERROR,
                JSONObject().put("message", message).put("failures", failures)
            )
        }
    }

    private fun cleanUpDir(dir: String, requiredFiles: List<String>) {
        Log.d(TAG, "requiredFiles for $dir $requiredFiles")
        val current = otaServices.fileProviderService.listFilesRecursive(dir)?.toList() ?: emptyList()
        val redundant = setDifference(current, requiredFiles)
        if (redundant.isEmpty()) {
            Log.d(TAG, "No clean-up required for dir: $dir")
            return
        }
        val startTime = System.currentTimeMillis()
        val failures = redundant.mapNotNull {
            if (otaServices.fileProviderService.deleteFileFromInternalStorage("$dir/$it")) {
                Log.d(TAG, "Deleted file $it from $dir")
                null
            } else {
                it
            }
        }
        if (failures.isNotEmpty()) {
            trackError(
                LogLabel.CLEAN_UP_ERROR,
                JSONObject()
                    .put("message", "Failed to delete some files during clean up.")
                    .put("failures", failures)
            )
        }

        logTimeTaken(startTime)
    }

    fun readResourceByName(name: String): String {
        val filePath = releaseConfig?.resources?.getResource(name)?.filePath
        val text = filePath?.let { readResourceByFileName(it) } ?: ""
        return text
    }

    fun readSplits(fileNames: String): String {
        val jsonArray = JSONArray(fileNames)
        val list: List<String> = (0 until jsonArray.length()).map { jsonArray.getString(it) }
        return readSplits(list).toString()
    }

    private fun readSplits(filePaths: List<String>): JSONObject {
        val jsonObject = JSONObject()

        val futures = filePaths.map {
            doAsync { it to readSplit(it) }
        }

        futures.forEach { future ->
            val (fileName, content) = future.get()
            jsonObject.put(fileName, content)
        }

        return jsonObject
    }

    private fun readResourceByFileName(filePath: String): String =
        readFile("$RESOURCES_DIR_NAME/$filePath")

    private fun readReleaseConfig(lock: Any): ReleaseConfig? {
        // TODO big change, need to do server change
        synchronized(lock) {
            try {
                var rcVersion = readFromInternalStorage(RC_VERSION_FILE_NAME)
                val (configString, pkgString, resString) = listOf(CONFIG_FILE_NAME, PACKAGE_MANIFEST_FILE_NAME, RESOURCES_FILE_NAME)
                    .map { readFromInternalStorage(it) }

                val bundledRC = if (listOf(configString, pkgString, resString).any { it.isEmpty() }) {
                    ReleaseConfig.deSerialize(otaServices.fileProviderService.readFromAssets("release_config.json")).getOrNull()
                } else {
                    null
                }

                if (rcVersion.isEmpty() && bundledRC != null) {
                    rcVersion = bundledRC.version
                }
                val config = loadConfigComponent(configString, CONFIG_FILE_NAME, bundledRC?.config, DEFAULT_CONFIG, ReleaseConfig::deSerializeConfig)
                val pkg = loadConfigComponent(pkgString, PACKAGE_MANIFEST_FILE_NAME, bundledRC?.pkg, DEFAULT_PKG, ReleaseConfig::deSerializePackage)
                val resources = loadConfigComponent(resString, RESOURCES_FILE_NAME, bundledRC?.resources, DEFAULT_RESOURCES, ReleaseConfig::deSerializeResources)

                Log.d(TAG, "Local release config loaded.")
                return ReleaseConfig(rcVersion, config, pkg, resources)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to read local release config. $e")
                trackReadReleaseConfigError(e)
            }
        }
        return null
    }

    private fun <T> loadConfigComponent(
        content: String,
        fileName: String,
        bundledValue: T?,
        defaultValue: T,
        deserializer: (String) -> Result<T>
    ): T {
        if (content.isNotEmpty()) {
            deserializer(content).onSuccess { return it }
                .onFailure { trackReadReleaseConfigError(it) }
        }

        return bundledValue
            ?: deserializer(readFromAssets(fileName)).getOrElse { defaultValue }
    }

    private fun trackReadReleaseConfigError(e: Throwable) {
        when (e) {
            is Exception -> {
                val value = JSONObject()
                    .put("error", e.message)
                    .put("stack_trace", Log.getStackTraceString(e))
                trackError("read_release_config_error", value)
            }
        }
    }

    private fun readFromInternalStorage(filePath: String): String =
        otaServices.fileProviderService.readFromInternalStorage("app/$filePath") ?: ""

    private fun readFromAssets(filePath: String): String =
        otaServices.fileProviderService.readFromAssets("app/$filePath") ?: ""

    private fun readFileAsync(filePath: String): Future<String> = doAsync {
        readFile(filePath)
    }

    private fun readFile(filePath: String): String =
        otaServices.fileProviderService.readFromFile("app/$filePath")

    fun readSplit(fileName: String): String {
        return readFile("$PACKAGE_DIR_NAME/$fileName")
    }

    fun readReleaseConfig(): String {
        return releaseConfig?.serialize() ?: ""
    }

    private fun trackUpdateResult(updateResult: UpdateResult) {
        val result = when (updateResult) {
            is UpdateResult.Ok -> "OK"
            is UpdateResult.PackageUpdateTimeout -> "PACKAGE_TIMEOUT"
            UpdateResult.ReleaseConfigFetchTimeout -> "RELEASE_CONFIG_TIMEOUT"
            UpdateResult.Error.RCFetchError -> "ERROR"
            UpdateResult.Error.Unknown -> "ERROR"
            UpdateResult.NA -> "NA"
        }
        trackInfo("update_result", JSONObject().put("result", result))
    }

    private fun trackBoot(releaseConfig: ReleaseConfig, startTime: Long) {
        val (rcVersion, config, pkg, resources) = releaseConfig
        val rversions = resources.fold(JSONArray()) { acc, v ->
            acc.put(v.fileName)
            acc
        }
        trackInfo(
            "boot",
            JSONObject()
                .put("release_config_version", rcVersion)
                .put("config_version", config.version)
                .put("package_version", pkg?.version)
                .put("resource_versions", rversions)
                .put("time_taken", System.currentTimeMillis() - startTime)
        )
    }

    private fun trackInfo(label: String, value: JSONObject) {
        trackGeneric(label, value, LogLevel.INFO)
    }

    private fun trackError(label: String, msg: String, e: Exception? = null) {
        val value = JSONObject().put("message", msg)
        e?.let { value.put("stack_trace", Log.getStackTraceString(e)) }
        trackError(label, value)
    }

    private fun trackError(label: String, value: JSONObject) {
        trackGeneric(label, value, LogLevel.ERROR)
    }

    private fun trackGeneric(label: String, value: JSONObject, level: String) {
        tracker.track(
            LogCategory.LIFECYCLE,
            LogSubCategory.LifeCycle.AIRBORNE,
            level,
            TAG,
            label,
            value
        )
    }

    private fun logTimeTaken(startTime: Long, label: String? = null) {
        val totalTime = System.currentTimeMillis() - startTime
        val msg = "Time ${totalTime}ms"
        if (label != null) {
            Log.d(TAG, "$label $msg")
        } else {
            Log.d(TAG, msg)
        }
    }

    enum class StateKey {
        SAVED_PACKAGE_UPDATE,
        SAVED_RESOURCE_UPDATE
    }

    private object LogLabel {
        const val APP_LOAD_EXCEPTION = "app_load_exception"
        const val CLEAN_UP_ERROR = "clean_up_error"
    }

    private fun getIndexFilePath(fileName: String): String {
        val file =
            otaServices.fileProviderService.getFileFromInternalStorage("app/$PACKAGE_DIR_NAME/$fileName")
        if (file.exists()) {
            return file.absolutePath
        }
        return ""
    }

    internal fun backupPackage(
        restorePoint: String
    ): Boolean {
        otaServices.fileProviderService.updateFile("$packageBackupDir/$restorePoint/.keep", ByteArray(0))

        otaServices.fileProviderService.listFilesRecursive(APP_DIR)?.forEach { name ->
            val data = otaServices.fileProviderService.readFromFile("$APP_DIR/$name")
            otaServices.fileProviderService.updateFile("$packageBackupDir/$restorePoint/$name", data.toByteArray())
        }
        Log.d(UpdateTask.TAG, "Created restore point at $restorePoint.")
        return true
    }

    /**
     * Creates a restore point with the given name.
     * If the restore point name is `default`, it throws an `IllegalArgumentException`.
     *
     * @param restorePoint The name of the restore point to create.
     * @throws IllegalArgumentException if the restore point name is `default`.
     */
    @Throws(IllegalArgumentException::class)
    fun createRestorePoint(restorePoint: String) {
        if (restorePoint == "default") {
            throw IllegalArgumentException(
                "Can't create restore point named `default` as it is a reserved restore point."
            )
        }
        backupPackage(restorePoint)
    }

    private fun addToRolledBackVersions(version: String) {
        val prefs = ctx.getSharedPreferences("hyper_ota_prefs", Context.MODE_PRIVATE)
        val rolledBackVersions = prefs.getStringSet("rolled_back_versions", mutableSetOf()) ?: mutableSetOf()
        rolledBackVersions.add(version)
        prefs.edit { putStringSet("rolled_back_versions", rolledBackVersions) }
        Log.d(TAG, "Added version $version to rolled-back versions list")
    }

    private fun isVersionRolledBack(version: String): Boolean {
        val prefs = ctx.getSharedPreferences("hyper_ota_prefs", Context.MODE_PRIVATE)
        val rolledBackVersions = prefs.getStringSet("rolled_back_versions", emptySet()) ?: emptySet()
        return rolledBackVersions.contains(version)
    }

    /**
     * Rolls back the package update to the specified restore point.
     * If the restore point does not exist, it returns false.
     *
     * @param restorePoint The name of the restore point to roll back to.
     * @return true if rollback was successful, false otherwise.
     */
    fun rollbackPackage(
        restorePoint: String = "default",
        allowReapplicationOfRolledBackVersion: Boolean = false
    ): Boolean {
        Log.d(UpdateTask.TAG, "Rolling back package update to $restorePoint.")
        cancelAllUpdateTasks()
        trackInfo("rollback_initiated", JSONObject().put("restore_point", restorePoint))
        val keepFile = otaServices.fileProviderService.getFileFromInternalStorage("$packageBackupDir/$restorePoint/.keep")
        if (keepFile.exists()) {
            otaServices.fileProviderService.listFilesRecursive("$packageBackupDir/$restorePoint")?.forEach { name ->
                val data = otaServices.fileProviderService.readFromFile("$packageBackupDir/$restorePoint/$name")
                otaServices.fileProviderService.updateFile("$APP_DIR/$name", data.toByteArray())
            }
            otaServices.fileProviderService.deleteFileFromInternalStorage("$packageBackupDir/$restorePoint/.keep")
            Log.d(UpdateTask.TAG, "Rollback successful at $restorePoint.")
            trackInfo("rollback_success", JSONObject().put("restore_point", restorePoint))
            if(!allowReapplicationOfRolledBackVersion) {
                releaseConfig?.let { rc ->
                    addToRolledBackVersions(rc.pkg.version)
                    trackInfo("release_blacklisted", JSONObject().put("version", rc.pkg.version))
                }
            }
            return true
        } else {
            Log.e(UpdateTask.TAG, "No backup found for rollback at restore point = $restorePoint.")
            trackInfo("rollback_failed", JSONObject().put("restore_point", restorePoint))
            return false
        }
    }

    fun cancelAllUpdateTasks() {
        val snapshot = RUNNING_UPDATE_TASKS.entries.toList()
        snapshot.forEach { (clientId, task) ->
            task.cancel()
            RUNNING_UPDATE_TASKS.remove(clientId)
        }
    }


    companion object {
        const val TAG = "ApplicationManager"
        private val CONTEXT_MAP:
            ConcurrentMap<String, WeakReference<Context>> = ConcurrentHashMap()
        private val RUNNING_UPDATE_TASKS:
            ConcurrentMap<String, UpdateTask> = ConcurrentHashMap()

        private fun <V> doAsync(callable: Callable<V>): Future<V> =
            OTAUtils.doAsync(callable)

        // Returns set difference, i.e. A - B
        private fun <V> setDifference(a: List<V>, b: List<V>): List<V> {
            return a.toSet().minus(b.toSet()).toList()
        }

        private fun sanitizeClientId(clientId: String) = clientId.split('_')[0].lowercase()
    }
}

interface ReleaseConfigCallback {
    fun shouldRetry(): Boolean
    fun getReleaseConfig(fetchFailed: Boolean): String
}

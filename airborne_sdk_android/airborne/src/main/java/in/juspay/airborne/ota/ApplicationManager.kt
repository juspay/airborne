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
import `in`.juspay.airborne.ota.Constants.APP_DIR
import `in`.juspay.airborne.ota.Constants.BACKUP_DIR
import `in`.juspay.airborne.ota.Constants.BACKUP_MAIN
import `in`.juspay.airborne.ota.Constants.BACKUP_TEMP
import org.json.JSONException

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
    private val backupTempDir = "$BACKUP_DIR/$BACKUP_TEMP"
    private val backupMainDir = "$BACKUP_DIR/$BACKUP_MAIN"

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
                    completeRollback(clientId)
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
                (ctx as Object).wait()
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

    fun completeRollback(clientId: String) {
        val rollbackInProgress = workspace.getFromSharedPreference(Constants.ROLLBACK_IN_PROGRESS, "false")
        if (rollbackInProgress == "true") {
            rollbackOTA(clientId)
        }
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
        val blackListedVersions = getRolledBackVersions()
        val newTask =
            UpdateTask(
                url ?: releaseConfigTemplateUrl,
                otaServices.fileProviderService,
                releaseConfig,
                blackListedVersions,
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
        checkIfBackupPending() //TODO: This can backup the next version also. Evaluate how that can be stopped.
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
        val splits = pkgSplits + newPkgSplits + resourceFiles + newResourceFiles
        cleanUpDir(pkgDir, splits)

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

    private fun checkIfBackupPending() {
        doAsync {
            val stage = workspace.getFromSharedPreference(Constants.BACKUP_STAGE, "")
            if (stage == "" || stage == BACKUP_STAGES.DONE.name || stage == BACKUP_STAGES.FAILED.name) {
                return@doAsync
            }
            backupOTA()
        }
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
        readFile("$PACKAGE_DIR_NAME/$filePath")

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

    private fun readReleaseConfigFromDir(folderPath: String): List<String> {
        return listOf(RC_VERSION_FILE_NAME, CONFIG_FILE_NAME, PACKAGE_MANIFEST_FILE_NAME, RESOURCES_FILE_NAME)
            .map { otaServices.fileProviderService.readFromInternalStorage("$folderPath/$it") }
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
            otaServices.fileProviderService.getFileFromInternalStorage("$APP_DIR/$PACKAGE_DIR_NAME/$fileName")
        if (file.exists()) {
            return file.absolutePath
        }
        return ""
    }

    /**
     * Creates a restore point which can be used in rollback.
     */
    fun createRestorePoint() {
        backupOTA()
    }

    internal fun backupOTA(): Boolean {
        val stage = workspace.getFromSharedPreference(Constants.BACKUP_STAGE, "")

        val (rcVersion, config, pkg, res) = readReleaseConfigFromDir("$backupMainDir/$APP_DIR")
        val (curRcVersion, curConfig, curPkg, curRes) = readReleaseConfigFromDir(APP_DIR)

        if (stage == BACKUP_STAGES.DONE.name && rcVersion == curRcVersion && config == curConfig && pkg == curPkg && res == curRes) {
            return true
        }

        if (BACKUP_STAGES.COPY_TO_BACKUP_IN_PROGRESS.name == stage) {
            // The backup is incomplete in this case, so can't be used. Or have to check if the versions of current and temp are same and then
            // take a decision based on that.
            val (tempRcVersion, tempConfig, tempPkg, tempRes) = readReleaseConfigFromDir("backupTempDir/$APP_DIR")
            if (curRcVersion == tempRcVersion && curConfig == tempConfig && curPkg == tempPkg && curRes == tempRes) {
                return backupInternal(stage)
            } else {
                return backupInternal(BACKUP_STAGES.STARTED.name)
            }
        }
        return backupInternal(if (stage == "" || stage == BACKUP_STAGES.FAILED.name) BACKUP_STAGES.STARTED.name else stage ?: BACKUP_STAGES.STARTED.name)
    }

    private fun backupInternal(stage: String): Boolean {

        var internalStage = stage
        val fps = otaServices.fileProviderService
        if (internalStage == BACKUP_STAGES.STARTED.name) {
            OTAUtils.deleteRecursive(fps.getFileFromInternalStorageInternal("$backupTempDir/"))
            workspace.writeToSharedPreference(Constants.BACKUP_STAGE, BACKUP_STAGES.STARTED.name)

            val files = fps.listFilesRecursive(APP_DIR)
            var tempWriteSuccess = true
            files?.forEach { name ->
                val fileName = "$APP_DIR/$name"
                val data = fps.readFromInternalStorage(fileName) // TODO: readFromFile -> Won't this read from assets? Is reading from assets fine?
                tempWriteSuccess = tempWriteSuccess && fps.writeToFile(fps.getFileFromInternalStorageInternal("$backupTempDir/$fileName"), data.toByteArray(), false, false) // "$backupTempDir/$name" is this correct?
            }

            if (tempWriteSuccess) {
                internalStage = BACKUP_STAGES.COPY_TO_BACKUP_IN_PROGRESS.name
                workspace.writeToSharedPreference(Constants.BACKUP_STAGE, BACKUP_STAGES.COPY_TO_BACKUP_IN_PROGRESS.name)
            } else {
                workspace.writeToSharedPreference(Constants.BACKUP_STAGE, BACKUP_STAGES.FAILED.name)
                return false
            }
        }

        if (internalStage == BACKUP_STAGES.COPY_TO_BACKUP_IN_PROGRESS.name) {
            workspace.writeToSharedPreference(Constants.BACKUP_STAGE, BACKUP_STAGES.COPY_TO_BACKUP_IN_PROGRESS.name)
            var copySuccess = true
            val files = fps.listFilesRecursive("$backupTempDir/$APP_DIR")
            files?.forEach { name ->
                val fileName = "$APP_DIR/$name"
                copySuccess = copySuccess && fps.getFileFromInternalStorageInternal("$backupTempDir/$fileName").renameTo(fps.getFileFromInternalStorageInternal("$backupMainDir/$fileName"))
            }

            if (copySuccess) {
                workspace.writeToSharedPreference(Constants.BACKUP_STAGE, BACKUP_STAGES.DONE.name)
                workspace.writeToSharedPreference(Constants.BACKUP_INPLACE, "true")
            } else {
                workspace.writeToSharedPreference(Constants.BACKUP_INPLACE, "false")
                workspace.writeToSharedPreference(Constants.BACKUP_STAGE, BACKUP_STAGES.FAILED.name)
                OTAUtils.deleteRecursive(fps.getFileFromInternalStorageInternal("$backupMainDir/"))
                return false
            }
        }

        Log.d(UpdateTask.TAG, "Created restore point at.")
        return true
    }

    private fun getRolledBackVersions(): JSONArray {
        return try {
            JSONArray(workspace.getFromSharedPreference(Constants.BLACKLISTED_VERSIONS, JSONArray().toString()))
        } catch (_: JSONException) {
            workspace.writeToSharedPreference(Constants.BLACKLISTED_VERSIONS, JSONArray().toString())
            JSONArray()
        }
    }

    private fun addToRolledBackVersions(versions: JSONObject) {
        val storedVersions = getRolledBackVersions()
        storedVersions.put(versions)
        workspace.writeToSharedPreference(Constants.BLACKLISTED_VERSIONS, storedVersions.toString())
        trackInfo("version added to rolled back versions", JSONObject().put("version added to rolled back versions", versions))
        Log.d(TAG, "Added version to rolled-back versions list $versions")
    }

    /**
     * Rolls back the package update to the last backed up versions.
     * If no back up exists then this function returns false.
     *
     * @return true if rollback was successful, false otherwise.
     */
    fun rollbackOTA(clientId: String): Boolean {
        workspace.writeToSharedPreference(Constants.ROLLBACK_IN_PROGRESS, "true")
        Log.d(UpdateTask.TAG, "Rolling back update.")
        cancelTask(clientId) // Will check this
        trackInfo("rollback_initiated", JSONObject().put("rc_version", releaseConfig?.version ?: "").put("config_version", releaseConfig?.config?.version ?: "").put("pkg_version", releaseConfig?.pkg?.version ?: ""))

        val backupStage = workspace.getFromSharedPreference(Constants.BACKUP_STAGE, "")
        val backupInplace = workspace.getFromSharedPreference(Constants.BACKUP_INPLACE, "false")

        val fps = otaServices.fileProviderService
        if (backupInplace == "false" || backupStage == BACKUP_STAGES.COPY_TO_BACKUP_IN_PROGRESS.name) {
            Log.e(UpdateTask.TAG, "No backup found for rollback, so deleting the contents inside app dir")
            // Here just delete everything
            OTAUtils.deleteRecursive(fps.getFileFromInternalStorage(APP_DIR))
            OTAUtils.deleteRecursive(fps.getFileFromInternalStorage(BACKUP_DIR))
            workspace.writeToSharedPreference(Constants.BACKUP_STAGE, "")
            trackInfo("rollback_failed", JSONObject().put("reason", "No backup found so deleting the contents inside app dir"))
            return true
        }

        // Here have to check if the app and backup has same versions, if yes then have to delete everything.
        if (backupInplace == "true") {
            val (_, config, pkg, res) = readReleaseConfigFromDir("$backupMainDir/$APP_DIR")

            ReleaseConfig.deSerializeConfig(config).onSuccess {
                it
                if (it.version == releaseConfig?.config?.version) {
                    // Now delete the config file in app dir and backup also
                    fps.getFileFromInternalStorage("$APP_DIR/$CONFIG_FILE_NAME").delete()
                    fps.getFileFromInternalStorage("$backupMainDir/$APP_DIR/$CONFIG_FILE_NAME").delete()
                }
            }

            ReleaseConfig.deSerializePackage(pkg).onSuccess { pkgSer ->
                if (pkgSer.version == releaseConfig?.pkg?.version) {
                    // Now delete the pkg file  and pkg splits in app dir and backup also
                    fps.getFileFromInternalStorage("$APP_DIR/$PACKAGE_MANIFEST_FILE_NAME").delete()
                    fps.getFileFromInternalStorage("$backupMainDir/$APP_DIR/$PACKAGE_MANIFEST_FILE_NAME").delete()

                    releaseConfig?.pkg?.filePaths?.map {
                        it
                        fps.getFileFromInternalStorage("$APP_DIR/$PACKAGE_DIR_NAME/$it").delete()
                        fps.getFileFromInternalStorage("$backupMainDir/$APP_DIR/$PACKAGE_DIR_NAME/$it").delete()
                    }

                }
            }

            if (releaseConfig?.resources?.toJSON().toString() == res) {
                // Now delete the resource file and resource splits of app dir and backup also
                fps.getFileFromInternalStorage("$APP_DIR/$RESOURCES_FILE_NAME").delete()
                fps.getFileFromInternalStorage("$backupMainDir/$APP_DIR/$RESOURCES_FILE_NAME").delete()

                releaseConfig?.resources?.filePaths?.map {
                    it
                    fps.getFileFromInternalStorage("$APP_DIR/$PACKAGE_DIR_NAME/$it").delete()
                    fps.getFileFromInternalStorage("$backupMainDir/$APP_DIR/$PACKAGE_DIR_NAME/$it").delete()
                }
            }
        }

        // We don't want to rollback this package as this is being rolled back now.
        if (backupStage == BACKUP_STAGES.STARTED.name) {
            workspace.writeToSharedPreference(Constants.BACKUP_STAGE, "")
        }
        var rollbackSuccess = false
        val files = fps.listFilesRecursive(backupMainDir)
        if (files?.isEmpty() ?: true) {
            trackInfo("rollback_failed", JSONObject().put("reason", "Backup folder is empty"))
        } else {
            files.forEach { name ->
                val fileName = "$APP_DIR/$name"
                val data = fps.readFromFile("$backupMainDir/$fileName")
                rollbackSuccess = fps.writeToFile(fps.getFileFromInternalStorageInternal("$APP_DIR/$name"), data.toByteArray(), false, false)
                if (!rollbackSuccess) {
                    trackInfo("rollback_failed", JSONObject().put("reason", "Not able to write the file $fileName from backup to main dir"))
                    return@forEach
                }
            }
        }

        if (!rollbackSuccess) {
            OTAUtils.deleteRecursive(fps.getFileFromInternalStorage(APP_DIR))
        }
        workspace.writeToSharedPreference(Constants.ROLLBACK_IN_PROGRESS, "false")

        if (rollbackSuccess) {
            Log.d(UpdateTask.TAG, "Rollback successful")
            trackInfo("rollback_success", JSONObject().put("result", "success"))
        }
        val resContent = releaseConfig?.resources?.toJSON().toString().toByteArray()
        val resHash = try {
            OTAUtils.SHA256(resContent).toString()
        } catch (_: Exception) {
            null
        }
        releaseConfig?.let { rc ->
            val json = JSONObject().put("configVersion", rc.config.version).put("pkgVersion", rc.pkg.version)
            resHash?.let {
                json.put("resHash", it)
            }
            addToRolledBackVersions(json)
            trackInfo("release_blacklisted", json)
        }
        return rollbackSuccess
    }

    fun cancelTask(clientId: String) {
        RUNNING_UPDATE_TASKS.remove(clientId)?.cancel()
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

enum class BACKUP_STAGES {
    STARTED,
    COPY_TO_BACKUP_IN_PROGRESS,
    DONE,
    FAILED
}

interface ReleaseConfigCallback {
    fun shouldRetry(): Boolean
    fun getReleaseConfig(fetchFailed: Boolean): String
}

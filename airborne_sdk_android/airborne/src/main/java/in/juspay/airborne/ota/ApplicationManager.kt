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

import android.app.ActivityManager
import android.app.Application
import android.content.Context
import android.os.Build
import android.os.Process
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
import `in`.juspay.hyperutil.constants.LogCategory
import `in`.juspay.hyperutil.constants.LogLevel
import `in`.juspay.hyperutil.constants.LogSubCategory
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap
import java.util.concurrent.Future
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.X509TrustManager

class ApplicationManager(
    private val ctx: Context,
    private var releaseConfigTemplateUrl: String,
    private val otaServices: OTAServices,
    private val metricsEndPoint: String? = null,
    private val rcHeaders: Map<String, String>? = null,
    private val onBootComplete: ((String) -> Unit)? = null,
    private val fromAirborne: Boolean = true,
    private val onPackageDownloaded: ((oldVersion: String, newVersion: String) -> Unit)? = null
) {
    /**
     * Opt-in boot guard. Set before [loadApplication]: the value is read once per process, when
     * the first manager of this workspace initialises the guard; later changes (and the value of
     * later managers) are ignored. Off by default (behaviour unchanged).
     */
    var bootGuardEnabled = false

    var telemetryEnabled = false
    private val telemetryExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
    private val sending = java.util.concurrent.atomic.AtomicBoolean(false)
    private fun forbidden(version: String) = synchronized(bootLock) {
        val a = bootState.optJSONArray("securityBlocked") ?: JSONArray()
        (0 until a.length()).any { a.optString(it) == version }
    }
    private fun received(rc: ReleaseConfig) = synchronized(bootLock) {
        val a = bootState.optJSONArray("securityBlocked") ?: JSONArray()
        val all = (0 until a.length()).map { a.getString(it) }.toMutableSet()
        all.addAll(rc.blockedPackageVersions)
        if (all.isNotEmpty()) bootState.put("securityBlocked", JSONArray(all.toList()))
        if (telemetryEnabled && rc.telemetry != null) {
            val receipts = bootState.optJSONObject("receipts") ?: JSONObject()
            receipts.put(rc.pkg.version, rc.telemetry); bootState.put("receipts", receipts)
        }
        if (all.isNotEmpty() || telemetryEnabled) saveBootState()
    }
    private fun report(version: String?, kind: String) {
        if (!telemetryEnabled || version == null) return
        try { synchronized(bootLock) {
            val receipt = bootState.optJSONObject("receipts")?.optJSONObject(version) ?: return
            val q = bootState.optJSONArray("queue") ?: JSONArray()
            q.put(JSONObject().put("meta", receipt).put("event", JSONObject().put("id", java.util.UUID.randomUUID().toString()).put("kind", kind)))
            while(q.length() > 128) q.remove(0)
            bootState.put("queue", q)
            if (!bootState.has("install")) bootState.put("install", java.util.UUID.randomUUID().toString())
            saveBootState()
        }; flushReports() } catch (_: Exception) { }
    }
    private fun reportEndpoint(meta: JSONObject): java.net.URL {
        val base = releaseConfigTemplateUrl.ifEmpty { rcCallback?.getReleaseConfig(false) ?: "" }
        return java.net.URL(java.net.URL(base), meta.getString("ingest_path"))
    }
    private fun flushReports() {
        if (!telemetryEnabled || !sending.compareAndSet(false,true)) return
        telemetryExecutor.execute {
            var accepted = false
            try {
                val batch = synchronized(bootLock) {
                    val q = bootState.optJSONArray("queue") ?: JSONArray()
                    val valid = (0 until q.length()).map { q.getJSONObject(it) }.filter { it.getJSONObject("meta").optLong("expires_at") > System.currentTimeMillis()/1000 }
                    bootState.put("queue", JSONArray(valid)); saveBootState()
                    val first = valid.firstOrNull() ?: return@execute
                    valid.filter { it.getJSONObject("meta").getString("receipt") == first.getJSONObject("meta").getString("receipt") }.take(32)
                }
                val meta = batch[0].getJSONObject("meta")
                val endpoint = reportEndpoint(meta)
                val conn = endpoint.openConnection() as java.net.HttpURLConnection
                conn.connectTimeout=5000; conn.readTimeout=5000; conn.requestMethod="POST"; conn.doOutput=true; conn.setRequestProperty("Content-Type","application/json")
                val body = JSONObject().put("receipt",meta.getString("receipt")).put("install_id",synchronized(bootLock) { bootState.getString("install") }).put("events",JSONArray(batch.map { it.getJSONObject("event") }))
                conn.outputStream.use { it.write(body.toString().toByteArray()) }
                val code=conn.responseCode; conn.disconnect(); accepted = code in 200..299 || code == 400
                if (code in 200..299 || code==400) synchronized(bootLock) {
                    val ids=batch.map { it.getJSONObject("event").getString("id") }.toSet()
                    val q=bootState.optJSONArray("queue") ?: JSONArray()
                    bootState.put("queue",JSONArray((0 until q.length()).map { q.getJSONObject(it) }.filter { it.getJSONObject("event").getString("id") !in ids })); saveBootState()
                }
            } catch (_: Exception) { } finally { sending.set(false); if (accepted) flushReports() }
        }
    }
    private val bootPrefs by lazy { ctx.applicationContext.getSharedPreferences("airborne-telemetry-${bootGuardKey()}", Context.MODE_PRIVATE) }
    private val bootLock = Any()
    private var bootState = try { JSONObject(bootPrefs.getString("state", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
    private fun saveBootState() {
        if (!bootPrefs.edit().putString("state", bootState.toString()).commit())
            trackError(LogLabel.BOOT_GUARD_ERROR, JSONObject().put("message", "Cannot persist telemetry/exclusions"))
    }
    private fun allowPackage(version: String): Boolean {
        if (forbidden(version)) { report(version, "blocked_package"); return false }
        return bootGuard?.allowPackage(version) ?: true
    }
    private var securityFallback = false


    /** Shared by every manager of this workspace in this process (see [BOOT_GUARDS]). */
    @Volatile
    private var bootGuard: BootGuard? = null

    /** The config handed to JS in this process (may be a last-good or bundled substitute). */
    @Volatile
    private var bootConfig: ReleaseConfig? = null

    /** The config installed on disk, before any boot guard substitution. */
    @Volatile
    private var installedConfig: ReleaseConfig? = null

    private val bundledConfig: ReleaseConfig? by lazy {
        ReleaseConfig.deSerialize(otaServices.fileProviderService.readFromAssets("release_config.json")).getOrNull()
            ?: ReleaseConfig.deSerialize(readFromAssets("release_config.json")).getOrNull()
    }

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
    private var pendingSslConfig: Pair<SSLSocketFactory, X509TrustManager>? = null

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
                initBootGuard()
                flushReports()
                if (telemetryEnabled) synchronized(bootLock) {
                    report(bootState.optString("telemetryPending").takeIf { it.isNotEmpty() }, "boot_failed")
                    bootState.remove("telemetryPending"); saveBootState()
                }
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
                val rc = selectBootConfig(releaseConfig!!)
                bootConfig = rc
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
                window.AIRBORNE_USE_LOCAL_ASSETS=${otaServices.useBundledAssets};
                window.AIRBORNE_OTA_BASE_PATH="${workspace.root.path + "/app/package"}";
                window.AIRBORNE_OTA_LOCAL_BASE_PATH="${workspace.path + "/app/package"}";
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
                onBootComplete?.let { it(indexFolderPath) }
                logTimeTaken(startTime, "loadApplication")
            }
        }
    }

    fun getApplicationContent(): String {
        loadWaitTask.get()
        return applicationContent
    }

    fun clearApplicationContent() {
        applicationContent = ""
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

    /**
     * Boot guard: records that the JS bundle is being handed to the JS runtime. Call it where
     * the host loads the bundle (not from Application.onCreate), so background process starts
     * are not counted. Only the first call per process counts; bundled boots are never counted.
     */
    fun prepareBoot() {
        getIndexBundlePath()
        val version = bootConfig?.pkg?.version
        if (version != null && BootFiles.trackedVersion(version, indexFolderPath) != null && telemetryEnabled) synchronized(bootLock) {
            if (bootState.optString("telemetryPending") != version) {
                report(version, "boot_started"); bootState.put("telemetryPending", version); saveBootState()
            }
        }
        val guard = bootGuard ?: return
        guard.prepareBoot(bootedPackage(guard))
    }

    /**
     * What [prepareBoot] hands to the guard: the package booted in this process, or null when
     * the boot is never tracked (guard off, bundled package, missing index).
     */
    private fun bootedPackage(guard: BootGuard): BootGuard.BootedPackage? {
        val rc = bootConfig ?: return null
        val version = BootFiles.trackedVersion(rc.pkg.version, indexFolderPath)
        if (!guard.enabled || version == null) {
            return null
        }
        return try {
            val snapshotFiles = if (fromAirborne) {
                rc.pkg.filePaths + rc.resources.filePaths
            } else {
                rc.pkg.filePaths
            }
            BootGuard.BootedPackage(
                version = version,
                indexPath = rc.pkg.index?.filePath ?: "",
                config = rc.serialize(),
                files = snapshotFiles
            )
        } catch (e: Exception) {
            trackError(LogLabel.BOOT_GUARD_ERROR, "Cannot describe the booted package.", e)
            null
        }
    }

    /**
     * Boot guard: acknowledges that the package booted in this process started healthily.
     * The guard acknowledges the package it recorded in [prepareBoot], so this works from any
     * manager of the workspace, including one re-created after a newer package was installed.
     * Never throws; the pending attempt is always cleared even if the snapshot fails.
     */
    fun markBootSuccess() {
        report(bootConfig?.pkg?.version?.takeIf { BootFiles.trackedVersion(it, indexFolderPath) != null }, "boot_success")
        if (telemetryEnabled) synchronized(bootLock) { bootState.remove("telemetryPending"); saveBootState() }
        val guard = bootGuard ?: BOOT_GUARDS.find(bootGuardKey()) ?: return
        try {
            // The copy can take a while: keep it off the caller's (native modules) thread.
            guard.markBootSuccess { snapshot -> doAsync { snapshot() } }
        } catch (e: Exception) {
            trackError(LogLabel.BOOT_GUARD_ERROR, "markBootSuccess failed.", e)
        }
    }

    /**
     * Attaches this manager to the process-wide guard of its workspace, creating it on first
     * use. Re-created managers share the guard and its once-per-process boot session, so they
     * cannot count more than one boot attempt per process.
     */
    private fun initBootGuard() {
        if (bootGuard != null) {
            return
        }
        val name = bootGuardKey()
        val guard = try {
            // Only process-scoped values reach the guard: the registry keeps it for the whole
            // process and must not keep this manager (or an Activity context) alive.
            val options = BootGuardOptions(
                key = name,
                enabled = bootGuardEnabled,
                appContext = ctx.applicationContext ?: ctx,
                packageDir = otaServices.fileProviderService.getFileFromInternalStorage("app/$PACKAGE_DIR_NAME"),
                manifestFile = otaServices.fileProviderService.getFileFromInternalStorage("app/$PACKAGE_MANIFEST_FILE_NAME"),
                useBundledAssets = otaServices.useBundledAssets
            )
            // Events go to the tracker of the manager that attached last (held weakly).
            BOOT_GUARDS.attach(name, bootGuardListener) { listener -> createBootGuard(options, listener) }
        } catch (e: Exception) {
            // Best effort: without a guard the app boots exactly as with the guard off.
            trackError(LogLabel.BOOT_GUARD_ERROR, "Boot guard unavailable.", e)
            return
        }
        guard.initialize()
        bootGuard = guard
    }

    /** SharedPreferences names cannot contain '/'; sanitise like Workspace does. */
    private fun bootGuardKey(): String = otaServices.workspace.path.replace('/', '_')

    private val bootGuardListener = object : BootGuard.Listener {
        override fun onRollback(version: String) {
            report(version, "rollback")
            trackInfo(LogLabel.ROLLBACK, JSONObject().put("packageVersion", version))
        }

        override fun onBlockedPackage(version: String) {
            report(version, "blocked_package")
            trackInfo(LogLabel.BLOCKED_PACKAGE, JSONObject().put("packageVersion", version))
        }

        override fun onError(message: String, error: Throwable?) {
            Log.e(TAG, "Boot guard: $message", error)
            val value = JSONObject().put("message", message)
            error?.let { value.put("stack_trace", Log.getStackTraceString(it)) }
            trackError(LogLabel.BOOT_GUARD_ERROR, value)
        }

        override fun onInfo(message: String) {
            Log.d(TAG, "Boot guard: $message")
            trackInfo(LogLabel.BOOT_GUARD_INFO, JSONObject().put("message", message))
        }
    }

    /**
     * Applies the boot guard selection to the config that would boot. The installed config is
     * kept for clean-up; the substitute becomes [releaseConfig] so JS sees what it runs.
     */
    private fun selectBootConfig(installed: ReleaseConfig): ReleaseConfig {
        installedConfig = installed
        val guard = bootGuard
        if (guard == null) {
            if (!forbidden(installed.pkg.version)) return installed
            securityFallback = true
            return (bundledConfig ?: installed).also { releaseConfig = it }
        }
        val selection = guard.select(installed.pkg.version, this::forbidden) { lastGood ->
            !forbidden(lastGood.version) && ReleaseConfig.deSerialize(lastGood.config).isSuccess
        }
        val selected = when (selection) {
            BootGuard.Selection.Installed -> return installed
            is BootGuard.Selection.LastGoodSnapshot ->
                ReleaseConfig.deSerialize(selection.lastGood.config).getOrNull() ?: installed
            BootGuard.Selection.Bundled -> bundledConfig ?: installed
        }
        Log.d(TAG, "Boot guard: ${installed.pkg.version} is blocked, booting ${selected.pkg.version}")
        releaseConfig = selected
        return selected
    }

    /** What the boot guard chose for this process; null when the guard is unavailable. */
    private fun bootSelection(): BootGuard.Selection? = if (securityFallback) BootGuard.Selection.Bundled else bootGuard?.currentSelection()

    /** UpdateTask callback: package files are about to be written into the package dir. */
    private fun onPackageInstallStarting() {
        bootGuard?.onPackageInstallStarting()
    }

    /** UpdateTask callback: a server-delivered package was committed to the package dir. */
    private fun onPackageInstalled(pkg: ReleaseConfig.PackageManifest) {
        val guard = bootGuard
        val complete = pkg.importantSplits.all { split ->
            otaServices.fileProviderService
                .getFileFromInternalStorage("app/$PACKAGE_DIR_NAME/${split.filePath}")
                .isFile
        }
        if (complete) {
            report(pkg.version, "package_downloaded")
            guard?.onPackageInstalled(pkg.version)
        }
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
        val originalUrl = if (releaseConfigTemplateUrl == "") rcCallback?.getReleaseConfig(false) else releaseConfigTemplateUrl
        val nativeVersion = ctx.packageManager.getPackageInfo(ctx.packageName,0).versionName ?: "unknown"
        val url = if (telemetryEnabled && originalUrl != null) android.net.Uri.parse(originalUrl).buildUpon().appendQueryParameter("telemetry_platform","android").appendQueryParameter("native_version",nativeVersion).build().toString() else originalUrl
        initNetUtils(clientId)
        netUtils.setTrackMetrics(metricsEndPoint != null)
        val newTask =
            UpdateTask(
                url ?: releaseConfigTemplateUrl,
                otaServices.fileProviderService,
                releaseConfig,
                fileLock,
                tracker,
                netUtils,
                rcHeaders,
                lazyDownloadCallback,
                fromAirborne,
                ctx,
                onPackageDownloaded,
                this::allowPackage,
                this::onPackageInstallStarting,
                this::onPackageInstalled,
                this::received
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
                    releaseConfigTemplateUrl =
                        rcCallback?.getReleaseConfig(true) ?: releaseConfigTemplateUrl
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

    fun checkForUpdate(): String {
        val url = if (rcCallback != null) {
            rcCallback?.getReleaseConfig(false) ?: releaseConfigTemplateUrl
        } else {
            releaseConfigTemplateUrl
        }

        if (url.isEmpty()) {
            return JSONObject()
                .put("updateAvailable", false)
                .put("error", "No release config URL")
                .toString()
        }

        val clientId =
            sanitizeClientId(otaServices.clientId?.takeIf { it.isNotBlank() } ?: "default")
        val contextRef = CONTEXT_MAP[clientId] ?: WeakReference(ctx)
        initNetUtils(clientId)
        val newTask = UpdateTask(
            url,
            otaServices.fileProviderService,
            releaseConfig,
            contextRef,
            tracker,
            netUtils,
            rcHeaders,
            null,
            fromAirborne,
            ctx
        )

        val remoteRC = newTask.fetchReleaseConfig()
        if (remoteRC == null) {
            Log.e(TAG, "checkForUpdate failed")
            return JSONObject()
                .put("updateAvailable", false)
                .put("error", "ReleaseConfig deSerializing failed or HTTP error")
                .toString()
        }

        return try {
            val localRc = releaseConfig

            val localVersion = localRc?.config?.version ?: ""
            val localPkgVersion = localRc?.pkg?.version ?: ""
            val remoteVersion = remoteRC.config.version
            val remotePkgVersion = remoteRC.pkg.version

            JSONObject()
                .put("updateAvailable", ((remoteVersion != localVersion) || (remotePkgVersion != localPkgVersion)))
                .put("currentVersion", localVersion)
                .put("remoteVersion", remoteVersion)
                .put("currentPackageVersion", localPkgVersion)
                .put("remotePackageVersion", remotePkgVersion)
                .toString()
        } catch (e: Exception) {
            Log.e(TAG, "checkForUpdate failed", e)
            JSONObject()
                .put("updateAvailable", false)
                .put("error", e.message ?: "Unknown error")
                .toString()
        }
    }

    @Synchronized
    private fun initNetUtils(clientId: String) {
        if (!::netUtils.isInitialized) {
            netUtils = OTANetUtils(ctx, clientId, otaServices.cleanUpValue)
        }
        // Apply pending SSL config if set
        pendingSslConfig?.let { (sslSocketFactory, trustManager) ->
            netUtils.setSslConfig(sslSocketFactory, trustManager)
            pendingSslConfig = null
        }
    }

    /**
     * Set custom SSL configuration for mTLS support.
     * Call this before loadApplication() to enable client certificate authentication.
     *
     * @param sslSocketFactory SSL socket factory configured with client certificate
     * @param trustManager Trust manager for server certificate validation
     */
    @Synchronized
    fun setSslConfig(sslSocketFactory: SSLSocketFactory, trustManager: X509TrustManager) {
        if (::netUtils.isInitialized) {
            netUtils.setSslConfig(sslSocketFactory, trustManager)
        } else {
            // Store for later when netUtils is initialized
            // This handles the case where setSslConfig is called before loadApplication
            pendingSslConfig = Pair(sslSocketFactory, trustManager)
        }
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
        // Boot guard snapshots live outside the package dir, so clean-up stays enabled. Keep the
        // installed package's splits and resources too when a substitute is booting.
        val keep = BootFiles.cleanUpKeepSet(
            fromAirborne,
            booting = releaseConfig?.let(::configFiles),
            installed = installedConfig?.let(::configFiles),
            updated = updatedRc?.let(::configFiles)
        )
        Log.d(TAG, "runCleanUp: Keeping: $keep")
        cleanUpDir("app/$PACKAGE_DIR_NAME", keep.packageDir)

        if (!fromAirborne) {
            cleanUpDir("app/$RESOURCES_DIR_NAME", keep.resourcesDir)
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

    private fun configFiles(rc: ReleaseConfig) =
        BootFiles.ConfigFiles(rc.pkg.filePaths, rc.resources.filePaths)

    private fun cleanUpDir(dir: String, requiredFiles: List<String>) {
        Log.d(TAG, "requiredFiles for $dir $requiredFiles")
        val current =
            otaServices.fileProviderService.listFilesRecursive(dir)?.toList() ?: emptyList()
        // listFilesRecursive gives encoded names only when !fromAirborne, so encode to match it.
        val required = if (fromAirborne) {
            requiredFiles
        } else {
            requiredFiles.map { otaServices.fileProviderService.hyperFileUtil.encodeFileName(it) }
        }
        val redundant = setDifference(current, required)
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
                val (configString, pkgString, resString) = listOf(
                    CONFIG_FILE_NAME,
                    PACKAGE_MANIFEST_FILE_NAME,
                    RESOURCES_FILE_NAME
                )
                    .map { readFromInternalStorage(it) }

                val bundledRC =
                    if (listOf(configString, pkgString, resString).any { it.isEmpty() }) {
                        val bundledRCString = if (fromAirborne) otaServices.fileProviderService.readFromAssets("release_config.json") else readFromAssets("release_config.json")

                        if (bundledRCString == null) {
                            null
                        } else {
                            ReleaseConfig.deSerialize(bundledRCString).getOrNull()
                        }
                    } else {
                        null
                    }

                if (rcVersion.isEmpty() && bundledRC != null) {
                    rcVersion = bundledRC.version
                }
                val config = loadConfigComponent(
                    configString,
                    CONFIG_FILE_NAME,
                    bundledRC?.config,
                    DEFAULT_CONFIG,
                    ReleaseConfig::deSerializeConfig
                )
                val pkg = loadConfigComponent(
                    pkgString,
                    PACKAGE_MANIFEST_FILE_NAME,
                    bundledRC?.pkg,
                    DEFAULT_PKG,
                    ReleaseConfig::deSerializePackage
                )
                val resources = loadConfigComponent(
                    resString,
                    RESOURCES_FILE_NAME,
                    bundledRC?.resources,
                    DEFAULT_RESOURCES,
                    ReleaseConfig::deSerializeResources
                )

                Log.d(TAG, "Local release config loaded.")
                return synchronized(bootLock) {
                    val blocked = bootState.optJSONArray("securityBlocked") ?: JSONArray()
                    ReleaseConfig(rcVersion, config, pkg, resources, (0 until blocked.length()).map { blocked.getString(it) }, bootState.optJSONObject("receipts")?.optJSONObject(pkg.version))
                }
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

    private fun readFile(filePath: String): String {
        readFileAsStream(filePath).use { stream ->
            return stream.readBytes().toString(Charsets.UTF_8)
        }
    }

    private fun readFileAsStream(filePath: String): BufferedInputStream =
        otaServices.fileProviderService.readFromFileAsStream("app/$filePath")

    fun readSplit(fileName: String): String =
        when (val source = BootFiles.splitSource(bootSelection(), fileName, ::snapshotFile)) {
            is BootFiles.Source.Snapshot -> readFallbackFile(source.file)
            is BootFiles.Source.Asset ->
                otaServices.fileProviderService.readFromAssets("app/$PACKAGE_DIR_NAME/${source.path}") ?: ""
            is BootFiles.Source.Installed -> readFile("$PACKAGE_DIR_NAME/${source.path}")
        }

    fun readSplitAsStream(fileName: String): BufferedInputStream {
        return when (val source = BootFiles.splitSource(bootSelection(), fileName, ::snapshotFile)) {
            is BootFiles.Source.Snapshot -> source.file?.takeIf { it.isFile }?.inputStream()?.buffered()
                ?: java.io.ByteArrayInputStream(byteArrayOf()).buffered()
            is BootFiles.Source.Asset -> otaServices.fileProviderService.readFromAssetsAsStream("app/$PACKAGE_DIR_NAME/${source.path}")
                ?: java.io.ByteArrayInputStream(byteArrayOf()).buffered()
            is BootFiles.Source.Installed -> readFileAsStream("$PACKAGE_DIR_NAME/${source.path}")
        }
    }

    fun readSplitAsFile(fileName: String): File {
        val stream = readSplitAsStream(fileName)
        // createTempFile needs a prefix of 3+ chars with no path separator.
        val baseName = fileName.substringAfterLast('/')
        val dotIndex = baseName.lastIndexOf('.')
        val prefix = (if (dotIndex > 0) baseName.substring(0, dotIndex) else baseName).padEnd(3, '_')
        val suffix = if (dotIndex > 0) baseName.substring(dotIndex) else ".tmp"

        val tempFile = File.createTempFile(prefix, suffix, this.ctx.cacheDir)

        stream.use { input ->
            tempFile.outputStream().buffered().use { output ->
                input.copyTo(output)
            }
        }

        return tempFile
    }

    private fun snapshotFile(path: String): File? = bootGuard?.fallbackFile(path)

    private fun readFallbackFile(file: File?): String = try {
        if (file != null && file.isFile) file.readText() else ""
    } catch (e: Exception) {
        trackError(LogLabel.BOOT_GUARD_ERROR, "Cannot read last-good file.", e)
        ""
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
            LogSubCategory.LifeCycle.HYPER_OTA,
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
        const val ROLLBACK = "rollback"
        const val BLOCKED_PACKAGE = "blocked-package"
        const val BOOT_GUARD_ERROR = "boot_guard_error"
        const val BOOT_GUARD_INFO = "boot_guard_info"
    }

    private fun getIndexFilePath(fileName: String): String =
        BootFiles.indexFilePath(bootSelection(), fileName, ::snapshotFile) { path ->
            otaServices.fileProviderService.getFileFromInternalStorage("app/$PACKAGE_DIR_NAME/$path")
        }

    companion object {
        const val TAG = "ApplicationManager"
        private const val BOOT_GUARD_PREFS_PREFIX = "airborne-boot-"
        private const val BOOT_GUARD_DIR_PREFIX = "airborne-boot-"
        private val CONTEXT_MAP:
            ConcurrentMap<String, WeakReference<Context>> = ConcurrentHashMap()
        private val RUNNING_UPDATE_TASKS:
            ConcurrentMap<String, UpdateTask> = ConcurrentHashMap()

        /** One boot guard per sanitised workspace per process. */
        private val BOOT_GUARDS = BootGuardRegistry()

        /** Process-scoped inputs of a workspace's boot guard; nothing here refers to a manager. */
        private class BootGuardOptions(
            val key: String,
            val enabled: Boolean,
            val appContext: Context,
            val packageDir: File,
            val manifestFile: File,
            val useBundledAssets: Boolean
        )

        /**
         * Builds the guard kept by [BOOT_GUARDS]. Defined on the companion so it cannot capture a
         * manager. With the guard off, leftover state is discarded once and an inert guard is kept.
         */
        private fun createBootGuard(options: BootGuardOptions, listener: BootGuard.Listener): BootGuard {
            val appContext = options.appContext
            val prefs = appContext.getSharedPreferences(
                "$BOOT_GUARD_PREFS_PREFIX${options.key}",
                Context.MODE_PRIVATE
            )
            val snapshotDir = File(appContext.filesDir, "$BOOT_GUARD_DIR_PREFIX${options.key}")
            val manifestFile = options.manifestFile
            val useBundledAssets = options.useBundledAssets
            return BootGuard.create(
                enabled = options.enabled,
                binaryIdentity = binaryIdentity(appContext),
                storage = SharedPreferencesBootGuardStorage(prefs),
                snapshots = FileSnapshotStore(snapshotDir, options.packageDir),
                installedVersion = { installedPackageVersion(manifestFile, useBundledAssets) },
                listener = listener,
                primaryProcess = isMainProcess(appContext)
            )
        }

        /**
         * Version named by the package manifest on disk; null when unknown. Reads the file
         * directly (like the snapshot store reads the package dir) so the guard needs no manager.
         */
        private fun installedPackageVersion(manifestFile: File, useBundledAssets: Boolean): String? {
            if (useBundledAssets || !manifestFile.isFile) {
                return null
            }
            val manifest = manifestFile.readText()
            if (manifest.isEmpty()) {
                return null
            }
            return ReleaseConfig.deSerializePackage(manifest).getOrNull()?.version
        }

        /** versionName + versionCode: a last-good package is only valid for the binary it ran on. */
        private fun binaryIdentity(ctx: Context): String = try {
            @Suppress("DEPRECATION")
            val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
            val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                info.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                info.versionCode.toLong()
            }
            "${info.versionName}+$versionCode"
        } catch (e: Exception) {
            Log.e(TAG, "Cannot read app version for the boot guard", e)
            ""
        }

        @Volatile
        private var mainProcess: Boolean? = null

        /**
         * True in the app's main process. Secondary processes (android:process services,
         * providers) may also construct Airborne, but must not write the guard state the main
         * process owns. When the process name cannot be determined the guard stays passive.
         */
        private fun isMainProcess(ctx: Context): Boolean {
            mainProcess?.let { return it }
            val mainName = ctx.applicationInfo?.processName ?: ctx.packageName
            val current = currentProcessName(ctx)
            if (current == null) {
                Log.w(TAG, "Boot guard: cannot determine the process name, guard inactive.")
            }
            return (current != null && current == mainName).also { mainProcess = it }
        }

        private fun currentProcessName(ctx: Context): String? {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return Application.getProcessName()
            }
            val fromActivityManager = try {
                val manager = ctx.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
                val pid = Process.myPid()
                manager?.runningAppProcesses?.firstOrNull { it.pid == pid }?.processName
            } catch (e: Exception) {
                Log.w(TAG, "Cannot read running processes", e)
                null
            }
            if (!fromActivityManager.isNullOrEmpty()) {
                return fromActivityManager
            }
            return try {
                File("/proc/self/cmdline").readText()
                    .substringBefore('\u0000')
                    .trim()
                    .ifEmpty { null }
            } catch (e: Exception) {
                null
            }
        }

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

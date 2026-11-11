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

import java.io.File
import java.io.IOException
import java.lang.ref.WeakReference
import java.util.UUID

/**
 * Opt-in boot guard: rolls back an OTA package whose JS never acknowledges a healthy start.
 *
 * Plain Kotlin (no Android or org.json types) so the state machine can be unit tested on the
 * JVM. Persistence and snapshot file operations are injected. Every public method is safe to
 * call from any thread and never throws: failures are reported through [Listener.onError] and
 * the guard degrades to best effort for the rest of the session.
 *
 * One instance per workspace per process (see ApplicationManager and [BootGuardRegistry]), so
 * the boot session below is shared by every manager of that workspace. The guard outlives
 * managers, so it must only be built from process-scoped values (files, preferences, plain
 * functions), never from a reference to a manager or its context. Lifecycle per process:
 * 1. [initialize] once, before any other call (binary-identity reset, rollback, orphan sweep).
 * 2. [allowPackage] / [onPackageInstallStarting] / [onPackageInstalled] while the update task runs.
 * 3. [select] once the package that would boot is known. The first call fixes the selection
 *    for the rest of the process; later calls (re-created managers) return it unchanged.
 * 4. [prepareBoot] when the JS bundle is handed to the JS runtime (counts an attempt and
 *    remembers the booted package for the rest of the process).
 * 5. [markBootSuccess] when JS reports a healthy start, from whichever manager is current.
 *
 * @param primaryProcess false in secondary processes of the app. The guard state belongs to the
 *   main process: a secondary process only reads it to refuse blocked packages, and never counts,
 *   substitutes, snapshots, sweeps or writes (it behaves as guard-off without discarding the state).
 * @param installedVersion version of the package currently installed on disk, or null if unknown.
 */
internal class BootGuard(
    val enabled: Boolean,
    private val binaryIdentity: String,
    private val storage: Storage,
    private val snapshots: SnapshotStore,
    private val installedVersion: () -> String?,
    private val listener: Listener,
    private val primaryProcess: Boolean = true
) {
    data class State(
        val binaryIdentity: String = "",
        val pending: String = "",
        val attempts: Int = 0,
        val blocked: String = "",
        val lastGood: LastGood? = null
    )

    /** A package that acknowledged a healthy boot, with a copy of its files in [snapshot]. */
    data class LastGood(
        val version: String,
        val indexPath: String,
        /** Serialized release config, opaque to the guard. */
        val config: String,
        /** Snapshot directory name (not a path) inside the snapshot store. */
        val snapshot: String
    )

    /** The package that started JS in this process and may become the next [LastGood]. */
    data class BootedPackage(
        val version: String,
        val indexPath: String,
        val config: String,
        val files: List<String>
    )

    sealed class Selection {
        /** Boot the installed package as usual. */
        object Installed : Selection()

        /** The installed package is blocked; boot [lastGood] from its snapshot. */
        data class LastGoodSnapshot(val lastGood: LastGood) : Selection()

        /** The installed package is blocked and no usable last-good exists; boot the APK assets. */
        object Bundled : Selection()
    }

    interface Storage {
        /** @return the stored state, or null when nothing is stored. */
        fun load(): State?

        fun save(state: State): Boolean

        fun clear(): Boolean
    }

    interface SnapshotStore {
        /** Names of every snapshot directory currently on disk. */
        fun list(): List<String>

        /** @return the file for [path] inside [snapshot], or null if it would escape the snapshot. */
        fun resolve(snapshot: String, path: String): File?

        /**
         * Copies [paths] of the installed package into a new snapshot directory.
         * Missing files are skipped, except [requiredPath] (the index).
         * @return the new snapshot name. Throws on failure, after deleting the partial directory.
         */
        fun create(paths: List<String>, requiredPath: String): String

        /**
         * @return true when [snapshot] holds [requiredPath] and every file of [paths] that now
         *   exists in the installed package (lazy splits downloaded after the snapshot).
         */
        fun isComplete(snapshot: String, paths: List<String>, requiredPath: String): Boolean

        fun delete(snapshot: String)
    }

    interface Listener {
        fun onRollback(version: String)

        fun onBlockedPackage(version: String)

        fun onError(message: String, error: Throwable?)

        /** Diagnostics that are not errors (for example a skipped snapshot). */
        fun onInfo(message: String) {}
    }

    /** The guard does work only in the process that owns its state. */
    private val active = enabled && primaryProcess

    private val lock = Any()
    private var state = State()
    private var initialized = false
    private var selection: Selection = Selection.Installed

    /** Set by the first [select]: what this process reads never changes after that. */
    private var selected = false
    private var bootPrepared = false

    /** Set by the first [prepareBoot]: the package whose JS runs in this process. */
    private var bootedPackage: BootedPackage? = null
    private var snapshotInProgress = false

    /**
     * Bumped before the update task starts writing a package into the package dir. A snapshot
     * is only taken when no install started since the booted package was selected, so files of
     * a package installed during this session are never recorded under the booted version.
     */
    private var installGeneration = 0
    private var selectedGeneration = 0
    private var bootGeneration = -1

    /** Applies binary-identity / guard-off resets, rollback and the orphan snapshot sweep. */
    fun initialize() {
        val events = Events()
        synchronized(lock) {
            if (initialized) {
                return
            }
            initialized = true
            val stored = loadState(events)
            if (!primaryProcess) {
                // Read only: the main process may be writing this state and its snapshots.
                if (enabled && stored != null && stored.binaryIdentity == binaryIdentity) {
                    state = stored
                }
                return@synchronized
            }
            if (!enabled) {
                discardLeftovers(stored, events)
                return@synchronized
            }
            state = when {
                stored == null -> State(binaryIdentity = binaryIdentity).also { persist(it, events) }
                stored.binaryIdentity != binaryIdentity -> {
                    // The last-good package was built for another binary: never use it.
                    discardAll(events)
                    State(binaryIdentity = binaryIdentity).also { persist(it, events) }
                }
                else -> stored
            }
            rollbackIfNeeded(events)
            sweepOrphanSnapshots(events)
        }
        events.dispatch()
    }

    fun isBlocked(version: String): Boolean = synchronized(lock) {
        enabled && state.blocked.isNotEmpty() && state.blocked == version
    }

    /** @return false (and reports it) when [version] is blocked and must not be installed. */
    fun allowPackage(version: String): Boolean {
        if (!isBlocked(version)) {
            return true
        }
        report { listener.onBlockedPackage(version) }
        return false
    }

    /** Called before the update task writes package files into the package dir. */
    fun onPackageInstallStarting() {
        synchronized(lock) {
            installGeneration++
        }
    }

    /**
     * Called after the update task committed a package delivered by the server with all its
     * required files present. Only this clears the block: a server that merely names another
     * version (download stalled or failed) must not re-enable the blocked package. It affects
     * the next process only: the selection of this process is fixed (see [select]).
     */
    fun onPackageInstalled(version: String) {
        val events = Events()
        synchronized(lock) {
            if (!active || state.blocked.isEmpty() || state.blocked == version) {
                return
            }
            updateState(state.copy(blocked = ""), events)
        }
        events.dispatch()
    }

    /**
     * Chooses what boots in this process. [isUsable] lets the caller reject a last-good whose
     * config cannot be parsed.
     *
     * Only the first call decides; every later call in this process returns that selection,
     * whatever [installedVersion] is now. The JS that is already running keeps reading its files
     * from the same source (snapshot, APK assets or package dir) even when a manager is
     * re-created after [onPackageInstalled] cleared the block.
     */
    fun select(installedVersion: String, isForbidden: (String) -> Boolean = { false }, isUsable: (LastGood) -> Boolean = { true }): Selection {
        val events = Events()
        val result = synchronized(lock) {
            if (selected) {
                return@synchronized selection
            }
            selected = true
            selectedGeneration = installGeneration
            selection = when {
                !isForbidden(installedVersion) && (!active || state.blocked.isEmpty() || installedVersion != state.blocked) -> Selection.Installed
                else -> {
                    events.add { listener.onBlockedPackage(installedVersion) }
                    val lastGood = usableLastGood(isUsable, events)
                    if (lastGood != null) Selection.LastGoodSnapshot(lastGood) else Selection.Bundled
                }
            }
            selection
        }
        events.dispatch()
        return result
    }

    fun currentSelection(): Selection = synchronized(lock) { selection }

    /** @return the snapshot copy of [path] while a last-good fallback is booting, else null. */
    fun fallbackFile(path: String): File? {
        val current = currentSelection() as? Selection.LastGoodSnapshot ?: return null
        return try {
            snapshots.resolve(current.lastGood.snapshot, path)
        } catch (e: Exception) {
            report { listener.onError("Cannot resolve snapshot file $path", e) }
            null
        }
    }

    /**
     * Counts a boot attempt of [booted] and remembers it as the package running in this process;
     * only the first call per process has an effect. Pass null for boots that are never tracked
     * (bundled package, missing index).
     */
    fun prepareBoot(booted: BootedPackage?) {
        val events = Events()
        synchronized(lock) {
            if (bootPrepared) {
                return
            }
            bootPrepared = true
            if (!active || booted == null || booted.version.isEmpty()) {
                return
            }
            val version = booted.version
            bootedPackage = booted
            bootGeneration = selectedGeneration
            val attempts = if (state.pending == version) state.attempts + 1 else 1
            updateState(state.copy(pending = version, attempts = attempts), events)
        }
        events.dispatch()
    }

    /**
     * Acknowledges a healthy start of the package remembered by [prepareBoot], whichever manager
     * calls it (a re-created manager may have a newer package installed than the one running).
     * Always clears the pending attempt first, then (outside the lock, through [runSnapshot])
     * snapshots the package unless it is already the last-good one with every installed file.
     */
    fun markBootSuccess(runSnapshot: (() -> Unit) -> Unit = { it() }) {
        val events = Events()
        val toSnapshot = synchronized(lock) {
            val booted = bootedPackage
            if (!active || booted == null || state.pending != booted.version) {
                return
            }
            updateState(state.copy(pending = "", attempts = 0), events)
            // Whether the existing snapshot is complete is checked off the caller's thread.
            val needed = selection !is Selection.LastGoodSnapshot && !snapshotInProgress
            if (needed) {
                snapshotInProgress = true
            }
            booted.takeIf { needed }
        }
        events.dispatch()
        if (toSnapshot == null) {
            return
        }
        try {
            runSnapshot { saveSnapshot(toSnapshot) }
        } catch (e: Exception) {
            synchronized(lock) { snapshotInProgress = false }
            report { listener.onError("Cannot schedule snapshot of ${toSnapshot.version}", e) }
        }
    }

    /** Current state, for tests and diagnostics. */
    fun currentState(): State = synchronized(lock) { state }

    private fun saveSnapshot(booted: BootedPackage) {
        val created = try {
            takeSnapshot(booted)
        } catch (e: Exception) {
            report { listener.onError("Cannot snapshot package ${booted.version}", e) }
            null
        }
        val events = Events()
        val obsolete = synchronized(lock) {
            snapshotInProgress = false
            if (created == null) {
                return@synchronized null
            }
            val previous = state.lastGood
            val lastGood = LastGood(booted.version, booted.indexPath, booted.config, created)
            val next = state.copy(lastGood = lastGood)
            // Persist before switching: if the write fails, memory must keep naming the previous
            // snapshot (still on disk), or a later save would store a reference to a deleted one.
            if (persist(next, events)) {
                state = next
                previous?.snapshot
            } else {
                created
            }
        }
        events.dispatch()
        obsolete?.let { deleteSnapshot(it) }
    }

    /**
     * Copies the booted package into a new snapshot.
     * @return its name, or null when the last-good snapshot of this version is already complete
     *   or the installed package is no longer the booted one.
     */
    private fun takeSnapshot(booted: BootedPackage): String? {
        if (!isBootedPackageInstalled(booted.version)) {
            report { listener.onInfo("Installed package changed since ${booted.version} booted; snapshot skipped") }
            return null
        }
        val current = currentState().lastGood
        val upToDate = current != null &&
            current.version == booted.version &&
            snapshots.isComplete(current.snapshot, booted.files, booted.indexPath)
        if (upToDate) {
            return null
        }
        val created = snapshots.create(booted.files, booted.indexPath)
        if (!isBootedPackageInstalled(booted.version)) {
            // An install started while copying: the copy may mix two packages.
            deleteSnapshot(created)
            report { listener.onInfo("Installed package changed while snapshotting ${booted.version}; snapshot discarded") }
            return null
        }
        return created
    }

    /** True when no install started since the boot was selected and the disk still has [version]. */
    private fun isBootedPackageInstalled(version: String): Boolean {
        val unchanged = synchronized(lock) { installGeneration == bootGeneration }
        if (!unchanged) {
            return false
        }
        return try {
            installedVersion() == version
        } catch (e: Exception) {
            report { listener.onError("Cannot read the installed package version", e) }
            false
        }
    }

    private fun rollbackIfNeeded(events: Events) {
        val current = state
        if (current.pending.isEmpty() || current.attempts < MAX_UNACKNOWLEDGED_BOOTS) {
            return
        }
        val failed = current.pending
        val lastGood = current.lastGood
        val fallbackFailed = lastGood != null && lastGood.version == failed
        val next = if (fallbackFailed) {
            // The fallback itself failed: drop it so the next boot uses the bundled package
            // instead of alternating between two broken packages.
            current.copy(lastGood = null, blocked = current.blocked.ifEmpty { failed })
        } else {
            current.copy(blocked = failed)
        }
        // The block applies to this session even if it cannot be persisted (best effort).
        val persisted = updateState(next.copy(pending = "", attempts = 0), events)
        if (fallbackFailed && persisted) {
            // Only once the stored state no longer names it; otherwise the next launch retries.
            lastGood?.let { deleteSnapshot(it.snapshot, events) }
        }
        events.add { listener.onRollback(failed) }
    }

    private fun usableLastGood(isUsable: (LastGood) -> Boolean, events: Events): LastGood? {
        val lastGood = state.lastGood ?: return null
        if (lastGood.version == state.blocked) {
            return null
        }
        return try {
            val indexPresent = snapshots.resolve(lastGood.snapshot, lastGood.indexPath)?.isFile == true
            lastGood.takeIf { indexPresent && isUsable(it) }
        } catch (e: Exception) {
            events.add { listener.onError("Cannot use last-good package ${lastGood.version}", e) }
            null
        }
    }

    private fun sweepOrphanSnapshots(events: Events) {
        val keep = state.lastGood?.snapshot
        listSnapshots(events)
            .filter { it != keep }
            .forEach { deleteSnapshot(it, events) }
    }

    private fun discardLeftovers(stored: State?, events: Events) {
        if (stored != null || listSnapshots(events).isNotEmpty()) {
            discardAll(events)
        }
    }

    private fun discardAll(events: Events) {
        state = State()
        val cleared = try {
            storage.clear()
        } catch (e: Exception) {
            events.add { listener.onError("Cannot clear boot guard state", e) }
            true
        }
        if (!cleared) {
            events.add { listener.onError("Cannot clear boot guard state", null) }
        }
        listSnapshots(events).forEach { deleteSnapshot(it, events) }
    }

    private fun loadState(events: Events): State? = try {
        storage.load()
    } catch (e: Exception) {
        events.add { listener.onError("Cannot read boot guard state", e) }
        // Treat unreadable state as foreign so it is discarded.
        State(binaryIdentity = "")
    }

    private fun listSnapshots(events: Events): List<String> = try {
        snapshots.list()
    } catch (e: Exception) {
        events.add { listener.onError("Cannot list boot guard snapshots", e) }
        emptyList()
    }

    /** Pass [events] when holding [lock] so the error is reported after it is released. */
    private fun deleteSnapshot(snapshot: String, events: Events? = null) {
        if (snapshot.isEmpty()) {
            return
        }
        try {
            snapshots.delete(snapshot)
        } catch (e: Exception) {
            val event = { listener.onError("Cannot delete snapshot $snapshot", e) }
            if (events != null) events.add(event) else report(event)
        }
    }

    /**
     * Updates in-memory state and persists it. Must hold [lock]. If persisting fails the session
     * keeps the in-memory state (best effort); use [persist] first where a failed write must not
     * change memory.
     */
    private fun updateState(next: State, events: Events): Boolean {
        state = next
        return persist(next, events)
    }

    private fun persist(next: State, events: Events): Boolean {
        val saved = try {
            storage.save(next)
        } catch (e: Exception) {
            events.add { listener.onError("Cannot persist boot guard state", e) }
            return false
        }
        if (!saved) {
            events.add { listener.onError("Cannot persist boot guard state", null) }
        }
        return saved
    }

    /** Calls the listener now; must not hold [lock]. A throwing listener is ignored. */
    private fun report(event: () -> Unit) {
        Events().apply { add(event) }.dispatch()
    }

    /**
     * Listener calls collected under the lock and dispatched after it is released. Every
     * listener call goes through [dispatch] (directly or via [report]), so a throwing listener
     * never escapes a public method.
     */
    private class Events {
        private val pending = mutableListOf<() -> Unit>()

        fun add(event: () -> Unit) {
            pending.add(event)
        }

        fun dispatch() {
            pending.forEach { event ->
                try {
                    event()
                } catch (_: Exception) {
                    // A misbehaving listener must not break the boot path.
                }
            }
        }
    }

    companion object {
        /**
         * Unacknowledged boots of one package before it is blocked.
         * Web, Android and iOS must use the same value.
         */
        const val MAX_UNACKNOWLEDGED_BOOTS = 2

        const val SNAPSHOT_PREFIX = "airborne-good-"

        /**
         * The guard of one workspace for this process. With [enabled] false it discards any
         * leftover state and snapshots right away (once per process, see [initialize]) and
         * returns an [inert] guard that keeps no reference to [storage], [snapshots],
         * [installedVersion] or [listener].
         */
        fun create(
            enabled: Boolean,
            binaryIdentity: String,
            storage: Storage,
            snapshots: SnapshotStore,
            installedVersion: () -> String?,
            listener: Listener,
            primaryProcess: Boolean
        ): BootGuard {
            if (enabled) {
                return BootGuard(true, binaryIdentity, storage, snapshots, installedVersion, listener, primaryProcess)
            }
            BootGuard(false, binaryIdentity, storage, snapshots, { null }, listener, primaryProcess).initialize()
            return inert()
        }

        /** A disabled guard without dependencies: tracks, writes and blocks nothing. */
        fun inert(): BootGuard =
            BootGuard(false, "", NoStorage, NoSnapshots, { null }, NoListener, primaryProcess = false)
                .also { it.initialize() }
    }

    private object NoStorage : Storage {
        override fun load(): State? = null

        override fun save(state: State): Boolean = true

        override fun clear(): Boolean = true
    }

    private object NoSnapshots : SnapshotStore {
        override fun list(): List<String> = emptyList()

        override fun resolve(snapshot: String, path: String): File? = null

        override fun create(paths: List<String>, requiredPath: String): String =
            throw IOException("Boot guard is disabled")

        override fun isComplete(snapshot: String, paths: List<String>, requiredPath: String): Boolean = false

        override fun delete(snapshot: String) {}
    }

    private object NoListener : Listener {
        override fun onRollback(version: String) {}

        override fun onBlockedPackage(version: String) {}

        override fun onError(message: String, error: Throwable?) {}
    }
}

/**
 * Snapshot directories `airborne-good-<uuid>` under [baseDir], taken from [packageDir].
 * Every path must be package-relative ([PackagePaths.isPackageRelativePath]) and stay inside
 * its root after canonicalisation. Files are copied, because package
 * files can be rewritten in place by the SDK's copy fallback.
 */
internal class FileSnapshotStore(
    private val baseDir: File,
    private val packageDir: File
) : BootGuard.SnapshotStore {

    override fun list(): List<String> {
        val dirs = baseDir.listFiles() ?: return emptyList()
        return dirs
            .filter { it.isDirectory && it.name.matches(SNAPSHOT_NAME) }
            .map { it.name }
    }

    override fun resolve(snapshot: String, path: String): File? {
        val dir = snapshotDir(snapshot) ?: return null
        return containedFile(dir, path)
    }

    override fun create(paths: List<String>, requiredPath: String): String {
        val name = BootGuard.SNAPSHOT_PREFIX + UUID.randomUUID()
        val dir = File(baseDir, name)
        try {
            if (!dir.mkdirs()) {
                throw IOException("Cannot create snapshot directory $name")
            }
            val required = normalise(requiredPath)
            for (path in paths.map(::normalise).distinct()) {
                copyIntoSnapshot(dir, path, isRequired = path == required)
            }
            if (resolve(name, required)?.isFile != true) {
                throw IOException("Snapshot is missing its index $requiredPath")
            }
            return name
        } catch (e: Exception) {
            dir.deleteRecursively()
            throw e
        }
    }

    override fun isComplete(snapshot: String, paths: List<String>, requiredPath: String): Boolean {
        val dir = snapshotDir(snapshot) ?: return false
        if (containedFile(dir, requiredPath)?.isFile != true) {
            return false
        }
        return paths.map(::normalise).distinct().all { path ->
            val installed = containedFile(packageDir, path)?.isFile == true
            !installed || containedFile(dir, path)?.isFile == true
        }
    }

    override fun delete(snapshot: String) {
        snapshotDir(snapshot)?.deleteRecursively()
    }

    private fun copyIntoSnapshot(dir: File, path: String, isRequired: Boolean) {
        val source = containedFile(packageDir, path)
            ?: throw IOException("Package path escapes the package directory: $path")
        val target = containedFile(dir, path)
            ?: throw IOException("Snapshot path escapes the snapshot directory: $path")
        if (!source.isFile) {
            if (isRequired) {
                throw IOException("Package file missing: $path")
            }
            return // Lazy split not downloaded yet.
        }
        target.parentFile?.mkdirs()
        source.copyTo(target, overwrite = true)
    }

    private fun snapshotDir(snapshot: String): File? {
        if (!snapshot.matches(SNAPSHOT_NAME)) {
            return null
        }
        return File(baseDir, snapshot)
    }

    companion object {
        private val SNAPSHOT_NAME = Regex("^${BootGuard.SNAPSHOT_PREFIX}[A-Za-z0-9-]+$")

        private fun normalise(path: String): String = path.replace('\\', '/').trim('/')

        /**
         * @return [root]/[relative], or null unless [relative] passes
         *   [PackagePaths.isPackageRelativePath] and its canonical file is strictly inside [root].
         */
        fun containedFile(root: File, relative: String): File? {
            if (!PackagePaths.isPackageRelativePath(relative)) {
                return null
            }
            val normalised = normalise(relative)
            if (normalised.isEmpty()) {
                return null
            }
            val rootFile = root.canonicalFile
            val candidate = File(rootFile, normalised).canonicalFile
            val inside = candidate.path.startsWith(rootFile.path + File.separator)
            return if (inside) candidate else null
        }
    }
}

/**
 * One [BootGuard] per key (sanitised workspace) per process, so the once-per-process boot
 * session holds even when managers are re-created. Events go to the listener attached last.
 *
 * The registry lives for the whole process, so it never keeps a manager alive: listeners are
 * held weakly (the attaching manager owns its listener), and the guards it stores must be built
 * from process-scoped values only (see [BootGuard]).
 */
internal class BootGuardRegistry {
    private val guards = HashMap<String, Entry>()

    /**
     * @return the guard of [key], created with [create] (given the forwarding listener to use)
     *   on first use; [listener] receives its events from now on, including those raised while
     *   [create] runs. Exceptions from [create] propagate and nothing is registered.
     */
    fun attach(
        key: String,
        listener: BootGuard.Listener,
        create: (BootGuard.Listener) -> BootGuard
    ): BootGuard {
        val entry = synchronized(guards) {
            guards[key]?.also { it.listener.attach(listener) } ?: ForwardingListener().let { forwarding ->
                forwarding.attach(listener)
                Entry(create(forwarding), forwarding).also { guards[key] = it }
            }
        }
        return entry.guard
    }

    /** @return the guard of [key] if one was created in this process. */
    fun find(key: String): BootGuard? = synchronized(guards) { guards[key]?.guard }

    private class Entry(val guard: BootGuard, val listener: ForwardingListener)

    private class ForwardingListener : BootGuard.Listener {
        @Volatile
        private var target: WeakReference<BootGuard.Listener>? = null

        fun attach(listener: BootGuard.Listener) {
            target = WeakReference(listener)
        }

        private fun current(): BootGuard.Listener? = target?.get()

        override fun onRollback(version: String) {
            current()?.onRollback(version)
        }

        override fun onBlockedPackage(version: String) {
            current()?.onBlockedPackage(version)
        }

        override fun onError(message: String, error: Throwable?) {
            current()?.onError(message, error)
        }

        override fun onInfo(message: String) {
            current()?.onInfo(message)
        }
    }
}

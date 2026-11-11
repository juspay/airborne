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

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.lang.ref.WeakReference

class BootGuardTest {
    @get:Rule
    val temp = TemporaryFolder()

    private lateinit var packageDir: File
    private lateinit var snapshotDir: File
    private lateinit var snapshots: FileSnapshotStore
    private val storage = MemoryStorage()
    private val events = mutableListOf<String>()

    /** Version named by the package manifest on disk. */
    private var installedVersion: String? = null

    private val listener = object : BootGuard.Listener {
        override fun onRollback(version: String) {
            events.add("rollback:$version")
        }

        override fun onBlockedPackage(version: String) {
            events.add("blocked-package:$version")
        }

        override fun onError(message: String, error: Throwable?) {
            events.add("error:$message")
        }

        override fun onInfo(message: String) {
            events.add("info:$message")
        }
    }

    @Before
    fun setUp() {
        packageDir = temp.newFolder("package")
        snapshotDir = temp.newFolder("snapshots")
        snapshots = FileSnapshotStore(snapshotDir, packageDir)
    }

    @Test fun securityExclusionFallsBackWithGuardOff() {
        val guard = process(enabled = false)
        assertEquals(BootGuard.Selection.Bundled, guard.select("bad", { it == "bad" }))
        assertEquals(BootGuard.Selection.Bundled, guard.select("new"))
    }

    @Test fun securityExcludedLastGoodIsNeverSelected() {
        install("good")
        val first = process()
        first.select("good")
        first.prepareBoot(booted("good"))
        first.markBootSuccess()
        install("bad")
        val next = process()
        assertEquals(BootGuard.Selection.Bundled, next.select("bad", { true }) { false })
    }

    /** One app process: a fresh guard over the same persisted storage and snapshot dir. */
    private fun process(
        enabled: Boolean = true,
        binary: String = BINARY_1,
        primary: Boolean = true,
        store: BootGuard.SnapshotStore = snapshots
    ): BootGuard =
        BootGuard(enabled, binary, storage, store, { installedVersion }, listener, primary)
            .also { it.initialize() }

    /** Installs like the SDK: files are replaced (never rewritten in place), then the manifest. */
    private fun install(version: String, vararg extraFiles: String) {
        writePackageFile(INDEX, "index $version")
        extraFiles.forEach { writePackageFile(it, "$it $version") }
        installedVersion = version
    }

    private fun writePackageFile(path: String, content: String) {
        val file = File(packageDir, path)
        file.parentFile?.mkdirs()
        file.delete()
        file.writeText(content)
    }

    private fun booted(version: String, vararg files: String) =
        BootGuard.BootedPackage(version, INDEX, "config-$version", listOf(INDEX) + files)

    /** Boots [version] (installed) and crashes before acknowledging. */
    private fun crashingBoot(version: String, binary: String = BINARY_1): BootGuard.Selection {
        val guard = process(binary = binary)
        val selection = guard.select(version)
        guard.prepareBoot(bootVersion(guard, selection, version)?.let { booted(it) })
        return selection
    }

    /** Boots and acknowledges a healthy start. */
    private fun healthyBoot(version: String, binary: String = BINARY_1): BootGuard.Selection {
        val guard = process(binary = binary)
        val selection = guard.select(version)
        val running = bootVersion(guard, selection, version)
        guard.prepareBoot(running?.let { booted(it) })
        if (running != null) {
            guard.markBootSuccess()
        }
        return selection
    }

    /** What ApplicationManager would pass to prepareBoot: bundled boots are never tracked. */
    private fun bootVersion(guard: BootGuard, selection: BootGuard.Selection, installed: String): String? =
        when (selection) {
            BootGuard.Selection.Installed -> installed
            is BootGuard.Selection.LastGoodSnapshot -> selection.lastGood.version.also {
                assertNotNull(guard.fallbackFile(INDEX))
            }
            BootGuard.Selection.Bundled -> null
        }

    @Test
    fun rollsBackAfterMaxUnacknowledgedBoots() {
        install("A")
        repeat(BootGuard.MAX_UNACKNOWLEDGED_BOOTS) {
            assertEquals(BootGuard.Selection.Installed, crashingBoot("A"))
        }
        assertEquals("A", storage.state?.pending)

        val guard = process()

        assertEquals("A", guard.currentState().blocked)
        assertEquals("", guard.currentState().pending)
        assertEquals(0, guard.currentState().attempts)
        assertTrue(events.contains("rollback:A"))
        assertTrue(guard.isBlocked("A"))
    }

    @Test
    fun oneUnacknowledgedBootDoesNotRollBack() {
        install("A")
        crashingBoot("A")

        val guard = process()

        assertEquals("", guard.currentState().blocked)
        assertEquals(BootGuard.Selection.Installed, guard.select("A"))
    }

    @Test
    fun fallsBackToLastGoodSnapshot() {
        install("L", "assets/logo.png")
        val guard = process()
        guard.select("L")
        guard.prepareBoot(booted("L", "assets/logo.png", "lazy-not-downloaded.js"))
        guard.markBootSuccess()
        val lastGood = guard.currentState().lastGood!!
        assertFalse("snapshot is stored as a name", lastGood.snapshot.contains(File.separator))

        install("A")
        crashingBoot("A")
        crashingBoot("A")

        val fallback = process()
        val selection = fallback.select("A")
        assertTrue(selection is BootGuard.Selection.LastGoodSnapshot)
        assertEquals("index L", fallback.fallbackFile(INDEX)!!.readText())
        assertEquals("assets/logo.png L", fallback.fallbackFile("assets/logo.png")!!.readText())
        assertTrue(events.contains("blocked-package:A"))
    }

    @Test
    fun fallsBackToBundledWithoutLastGood() {
        install("A")
        crashingBoot("A")
        crashingBoot("A")

        val guard = process()

        assertEquals(BootGuard.Selection.Bundled, guard.select("A"))
        assertNull(guard.fallbackFile(INDEX))
    }

    @Test
    fun fallsBackToBundledWhenSnapshotIndexIsMissing() {
        install("L")
        healthyBoot("L")
        val snapshot = storage.state!!.lastGood!!.snapshot
        File(File(snapshotDir, snapshot), INDEX).delete()
        install("A")
        crashingBoot("A")
        crashingBoot("A")

        assertEquals(BootGuard.Selection.Bundled, process().select("A"))
    }

    @Test
    fun blockIsNotClearedByAStalledDownloadOfANewerVersion() {
        install("A")
        crashingBoot("A")
        crashingBoot("A")
        val guard = process()

        // The server now names C, but C never finishes downloading.
        assertTrue(guard.allowPackage("C"))
        assertFalse(guard.allowPackage("A"))

        assertTrue(process().isBlocked("A"))
        assertEquals(BootGuard.Selection.Bundled, process().select("A"))
    }

    @Test
    fun blockIsClearedOnlyWhenAnotherPackageIsInstalled() {
        install("A")
        crashingBoot("A")
        crashingBoot("A")
        val guard = process()

        guard.onPackageInstalled("A")
        assertTrue(guard.isBlocked("A"))

        guard.onPackageInstalled("C")
        assertFalse(guard.isBlocked("A"))
        assertEquals("", storage.state?.blocked)
    }

    @Test
    fun failingFallbackDropsLastGoodAndUsesBundled() {
        install("L")
        healthyBoot("L")
        val lastGoodSnapshot = storage.state!!.lastGood!!.snapshot
        install("A")
        crashingBoot("A")
        crashingBoot("A")

        // L also crashes when booted as the fallback.
        assertTrue(crashingBoot("A") is BootGuard.Selection.LastGoodSnapshot)
        assertTrue(crashingBoot("A") is BootGuard.Selection.LastGoodSnapshot)

        val guard = process()
        assertNull(guard.currentState().lastGood)
        assertEquals("A", guard.currentState().blocked)
        assertFalse(File(snapshotDir, lastGoodSnapshot).exists())
        assertEquals(BootGuard.Selection.Bundled, guard.select("A"))

        // Bundled boots are not tracked, so there is no further rollback loop.
        guard.prepareBoot(null)
        assertEquals(BootGuard.Selection.Bundled, process().select("A"))
        assertEquals("", storage.state?.pending)
    }

    @Test
    fun installedLastGoodThatStartsFailingIsBlocked() {
        install("L")
        healthyBoot("L")
        crashingBoot("L")
        crashingBoot("L")

        val guard = process()

        assertNull(guard.currentState().lastGood)
        assertEquals("L", guard.currentState().blocked)
        assertEquals(BootGuard.Selection.Bundled, guard.select("L"))
    }

    @Test
    fun markBootSuccessClearsPendingEvenIfSnapshotFails() {
        // The manifest names A but its index is missing on disk: the snapshot cannot be taken.
        installedVersion = "A"
        val guard = process()
        guard.select("A")
        guard.prepareBoot(booted("A"))

        guard.markBootSuccess()

        assertEquals("", guard.currentState().pending)
        assertEquals(0, guard.currentState().attempts)
        assertNull(guard.currentState().lastGood)
        assertTrue(snapshots.list().isEmpty())
        assertTrue(events.any { it.startsWith("error:Cannot snapshot") })
    }

    @Test
    fun markBootSuccessRejectsPathsEscapingTheSnapshot() {
        install("A")
        File(temp.root, "secret").writeText("secret")
        val guard = process()
        guard.select("A")
        guard.prepareBoot(booted("A", "../secret"))

        guard.markBootSuccess()

        assertEquals("", guard.currentState().pending)
        assertNull(guard.currentState().lastGood)
        assertTrue("partial snapshot deleted", snapshots.list().isEmpty())
    }

    @Test
    fun newSnapshotReplacesThePreviousOne() {
        install("L1")
        healthyBoot("L1")
        val first = storage.state!!.lastGood!!.snapshot
        install("L2")
        healthyBoot("L2")

        val lastGood = storage.state!!.lastGood!!
        assertEquals("L2", lastGood.version)
        assertEquals(listOf(lastGood.snapshot), snapshots.list())
        assertFalse(File(snapshotDir, first).exists())
    }

    @Test
    fun healthyBootOfLastGoodDoesNotSnapshotAgain() {
        install("L")
        healthyBoot("L")
        val snapshot = storage.state!!.lastGood!!.snapshot

        healthyBoot("L")

        assertEquals(snapshot, storage.state!!.lastGood!!.snapshot)
        assertEquals(listOf(snapshot), snapshots.list())
    }

    @Test
    fun fallbackBootIsAcknowledgedWithoutANewSnapshot() {
        install("L")
        healthyBoot("L")
        val snapshot = storage.state!!.lastGood!!.snapshot
        install("A")
        crashingBoot("A")
        crashingBoot("A")

        assertTrue(healthyBoot("A") is BootGuard.Selection.LastGoodSnapshot)

        assertEquals("", storage.state!!.pending)
        assertEquals(snapshot, storage.state!!.lastGood!!.snapshot)
        assertEquals(listOf(snapshot), snapshots.list())
    }

    @Test
    fun onlyTheFirstPrepareBootPerProcessCounts() {
        install("A")
        val guard = process()
        guard.select("A")

        guard.prepareBoot(booted("A"))
        guard.prepareBoot(booted("A"))

        assertEquals(1, guard.currentState().attempts)
    }

    @Test
    fun bundledBootsAreNeverTracked() {
        val guard = process()
        guard.select("bundled")

        guard.prepareBoot(null)

        assertEquals("", guard.currentState().pending)
        assertEquals(0, guard.currentState().attempts)
    }

    @Test
    fun binaryIdentityChangeResetsStateAndSnapshots() {
        install("L")
        healthyBoot("L")
        install("A")
        crashingBoot("A")
        crashingBoot("A")

        val guard = process(binary = BINARY_2)

        assertEquals(BootGuard.State(binaryIdentity = BINARY_2), guard.currentState())
        assertTrue(snapshots.list().isEmpty())
        assertEquals(BootGuard.Selection.Installed, guard.select("A"))
    }

    @Test
    fun guardOffDiscardsLeftoverState() {
        install("L")
        healthyBoot("L")
        install("A")
        crashingBoot("A")
        crashingBoot("A")
        process() // Blocks A.

        val off = process(enabled = false)

        assertNull(storage.state)
        assertTrue(snapshots.list().isEmpty())
        assertEquals(BootGuard.Selection.Installed, off.select("A"))
        assertTrue(off.allowPackage("A"))
        // Re-enabling later starts clean: A is not blocked.
        assertFalse(process().isBlocked("A"))
    }

    @Test
    fun guardOffDoesNotTrackOrWrite() {
        install("A")
        val guard = process(enabled = false)
        guard.select("A")
        guard.prepareBoot(booted("A"))
        guard.markBootSuccess()

        assertNull(storage.state)
        assertTrue(snapshots.list().isEmpty())
    }

    @Test
    fun orphanSnapshotsAreSweptAtInit() {
        install("L")
        healthyBoot("L")
        val kept = storage.state!!.lastGood!!.snapshot
        File(snapshotDir, "${BootGuard.SNAPSHOT_PREFIX}orphan").mkdirs()
        File(snapshotDir, "unrelated").mkdirs()

        process()

        assertEquals(listOf(kept), snapshots.list())
        assertTrue("non-snapshot dirs are left alone", File(snapshotDir, "unrelated").exists())
    }

    @Test
    fun persistenceFailureNeverThrows() {
        install("A")
        storage.failSaves = true
        val guard = process()
        guard.select("A")
        guard.prepareBoot(booted("A"))
        guard.markBootSuccess()

        assertTrue(events.any { it.startsWith("error:Cannot persist") })
        // The unpersisted snapshot is not kept, and memory does not name it.
        assertTrue(snapshots.list().isEmpty())
        assertNull(guard.currentState().lastGood)
    }

    @Test
    fun failedSnapshotPersistKeepsThePreviousLastGood() {
        install("L")
        healthyBoot("L")
        val previous = storage.state!!.lastGood!!
        install("A")
        crashingBoot("A")
        crashingBoot("A")

        // This process blocks A and boots B, which acknowledges, but the snapshot write fails.
        val guard = process()
        install("B")
        guard.select("B")
        guard.prepareBoot(booted("B"))
        storage.failSavesWithLastGood = true
        guard.markBootSuccess()
        storage.failSavesWithLastGood = false

        assertTrue(events.any { it.startsWith("error:Cannot persist") })
        // Memory still names the previous snapshot, which is still on disk; B's copy is gone.
        assertEquals(previous, guard.currentState().lastGood)
        assertEquals(listOf(previous.snapshot), snapshots.list())

        // A later successful save (B's install clears the block) keeps the previous last-good.
        guard.onPackageInstalled("B")
        assertEquals("", storage.state!!.blocked)
        assertEquals(previous, storage.state!!.lastGood)

        val next = process()
        assertEquals(previous, next.currentState().lastGood)
        assertEquals(listOf(previous.snapshot), snapshots.list())
        assertEquals("index L", File(File(snapshotDir, previous.snapshot), INDEX).readText())
    }

    @Test
    fun packageInstalledDuringTheSessionIsNotSnapshotted() {
        install("A")
        val guard = process()
        guard.select("A")
        guard.prepareBoot(booted("A"))

        // The update task installs B into the live package dir while A is running.
        guard.onPackageInstallStarting()
        install("B")
        guard.markBootSuccess()

        assertEquals("", guard.currentState().pending)
        assertNull(guard.currentState().lastGood)
        assertTrue(snapshots.list().isEmpty())
        assertTrue(events.any { it.startsWith("info:Installed package changed") })
    }

    @Test
    fun packageReplacedOnDiskByAnotherWriterIsNotSnapshotted() {
        install("A")
        val guard = process()
        guard.select("A")
        guard.prepareBoot(booted("A"))
        installedVersion = "B" // Manifest on disk names another version.

        guard.markBootSuccess()

        assertNull(guard.currentState().lastGood)
        assertTrue(snapshots.list().isEmpty())
    }

    @Test
    fun installStartingWhileSnapshottingDiscardsTheCopy() {
        install("A")
        lateinit var guard: BootGuard
        val racingStore = object : BootGuard.SnapshotStore by snapshots {
            override fun create(paths: List<String>, requiredPath: String): String =
                snapshots.create(paths, requiredPath).also { guard.onPackageInstallStarting() }
        }
        guard = process(store = racingStore)
        guard.select("A")
        guard.prepareBoot(booted("A"))

        guard.markBootSuccess()

        assertNull(guard.currentState().lastGood)
        assertTrue("partial copy deleted", snapshots.list().isEmpty())
    }

    @Test
    fun installBeforeSelectionDoesNotPreventTheSnapshot() {
        val guard = process()
        // A saved package is installed before the boot is selected (same loadApplication).
        guard.onPackageInstallStarting()
        install("A")
        guard.select("A")
        guard.prepareBoot(booted("A"))

        guard.markBootSuccess()

        assertEquals("A", guard.currentState().lastGood?.version)
    }

    @Test
    fun lateLazyFilesAreAddedOnALaterHealthyBoot() {
        install("L")
        val first = process()
        first.select("L")
        first.prepareBoot(booted("L", "lazy.js"))
        first.markBootSuccess()
        val initial = storage.state!!.lastGood!!.snapshot
        assertNull(snapshots.resolve(initial, "lazy.js")?.takeIf { it.isFile })

        // The lazy split finished downloading after the first acknowledgement.
        writePackageFile("lazy.js", "lazy.js L")
        val second = process()
        second.select("L")
        second.prepareBoot(booted("L", "lazy.js"))
        second.markBootSuccess()

        val refreshed = storage.state!!.lastGood!!
        assertEquals("L", refreshed.version)
        assertEquals("lazy.js L", snapshots.resolve(refreshed.snapshot, "lazy.js")!!.readText())
        assertEquals(listOf(refreshed.snapshot), snapshots.list())
        assertFalse(File(snapshotDir, initial).exists())
    }

    @Test
    fun snapshotIsACopyThatSurvivesPackageRewrites() {
        install("L")
        healthyBoot("L")
        val snapshotIndex = snapshots.resolve(storage.state!!.lastGood!!.snapshot, INDEX)!!

        // Package files may be rewritten in place; the snapshot must not change with them.
        File(packageDir, INDEX).writeText("index A")

        assertEquals("index L", snapshotIndex.readText())
    }

    @Test
    fun secondaryProcessNeverWritesOrSweeps() {
        install("L")
        healthyBoot("L")
        install("A")
        crashingBoot("A")
        crashingBoot("A")
        process() // Main process blocks A.
        val stored = storage.state
        // A snapshot the main process is still writing.
        val inProgress = File(snapshotDir, "${BootGuard.SNAPSHOT_PREFIX}in-progress").apply { mkdirs() }

        val secondary = process(primary = false)
        val selection = secondary.select("A")
        secondary.prepareBoot(booted("A"))
        secondary.markBootSuccess()
        secondary.onPackageInstalled("C")

        assertEquals(BootGuard.Selection.Installed, selection)
        assertFalse("still refuses the blocked package", secondary.allowPackage("A"))
        assertEquals(stored, storage.state)
        assertTrue(inProgress.exists())
    }

    @Test
    fun secondaryProcessWithGuardOffKeepsTheState() {
        install("L")
        healthyBoot("L")
        val stored = storage.state

        process(enabled = false, primary = false)

        assertEquals(stored, storage.state)
        assertEquals(listOf(stored!!.lastGood!!.snapshot), snapshots.list())
    }

    @Test
    fun registrySharesOneGuardPerKey() {
        val registry = BootGuardRegistry()
        val created = mutableListOf<BootGuard.Listener>()
        val create = { forwarding: BootGuard.Listener ->
            created.add(forwarding)
            BootGuard(true, BINARY_1, storage, snapshots, { installedVersion }, forwarding)
        }
        val firstEvents = mutableListOf<String>()
        val first = registry.attach("ws", recordingListener(firstEvents), create)
        val second = registry.attach("ws", listener, create)
        val other = registry.attach("other", listener, create)

        assertTrue(first === second)
        assertFalse(first === other)
        assertEquals(2, created.size)

        // A re-created manager shares the boot session: only one attempt per process.
        install("A")
        first.initialize()
        first.select("A")
        first.prepareBoot(booted("A"))
        second.initialize()
        second.select("A")
        second.prepareBoot(booted("A"))
        assertEquals(1, storage.state!!.attempts)

        // Events go to the listener attached last.
        created[0].onBlockedPackage("X")
        assertTrue(firstEvents.isEmpty())
        assertTrue(events.contains("blocked-package:X"))
    }

    @Test
    fun registryDoesNotKeepTheAttachingManagerAlive() {
        val registry = BootGuardRegistry()
        val create = { forwarding: BootGuard.Listener ->
            BootGuard(true, BINARY_1, storage, snapshots, { installedVersion }, forwarding)
        }
        val firstManager = attachManager(registry, create)

        assumeGcRuns()
        assertTrue("the registry must not retain a re-created manager", collected(firstManager))

        // The guard outlives its first manager and reports to the manager attached next.
        storage.state = BootGuard.State(binaryIdentity = BINARY_1, blocked = "Y")
        val next = FakeManager()
        val guard = registry.attach("ws", next.listener, create)
        assertTrue(guard === registry.find("ws"))
        guard.initialize()
        assertFalse(guard.allowPackage("Y"))
        assertEquals(listOf("blocked-package:Y"), next.events)
    }

    @Test
    fun disabledGuardDiscardsLeftoversOnceAndKeepsNoDependencies() {
        install("L")
        healthyBoot("L")
        install("A")
        crashingBoot("A")
        assertNotNull(storage.state)
        val manager = FakeManager()
        var storageRef: WeakReference<BootGuard.Storage>? = null
        var storeRef: WeakReference<BootGuard.SnapshotStore>? = null
        val registry = BootGuardRegistry()

        val guard = registry.attach("ws", manager.listener) { forwarding ->
            val leftoverStorage = object : BootGuard.Storage by storage {}
            val leftoverStore = object : BootGuard.SnapshotStore by snapshots {}
            storageRef = WeakReference(leftoverStorage)
            storeRef = WeakReference(leftoverStore)
            BootGuard.create(false, BINARY_1, leftoverStorage, leftoverStore, { installedVersion }, forwarding, true)
        }

        assertNull("leftover state discarded (rule 3)", storage.state)
        assertTrue(snapshots.list().isEmpty())
        assertFalse(guard.enabled)
        guard.initialize()
        assertEquals(BootGuard.Selection.Installed, guard.select("A"))
        guard.prepareBoot(booted("A"))
        guard.markBootSuccess()
        assertNull(storage.state)
        assumeGcRuns()
        assertTrue("the registered guard is inert", collected(storageRef!!) && collected(storeRef!!))
        assertTrue(guard === registry.find("ws"))
    }

    @Test
    fun ackFromARecreatedManagerAcknowledgesTheBootedPackage() {
        install("A")
        val registry = BootGuardRegistry()
        val create = { forwarding: BootGuard.Listener ->
            BootGuard(true, BINARY_1, storage, snapshots, { installedVersion }, forwarding)
        }
        val first = registry.attach("ws", listener, create).also { it.initialize() }
        first.select("A")
        first.prepareBoot(booted("A"))
        assertEquals("A", storage.state!!.pending)

        // A staged package B is installed while A runs, then the host re-creates Airborne: the
        // new manager's config names B, but the JS that acknowledges is A's.
        first.onPackageInstallStarting()
        install("B")
        first.onPackageInstalled("B")
        val second = registry.attach("ws", listener, create).also { it.initialize() }
        second.select("B")
        second.prepareBoot(booted("B"))
        second.markBootSuccess()

        assertEquals("", storage.state!!.pending)
        assertEquals(0, storage.state!!.attempts)
        // A's files were replaced by B's, so A is not snapshotted under its name.
        assertNull(storage.state!!.lastGood)
        assertTrue(events.any { it.startsWith("info:Installed package changed since A booted") })
    }

    @Test
    fun ackWithoutATrackedBootDoesNothing() {
        install("A")
        val guard = process()
        guard.select("A")
        guard.prepareBoot(null)

        guard.markBootSuccess()

        assertEquals("", guard.currentState().pending)
        assertNull(guard.currentState().lastGood)
    }

    /** Stands in for an ApplicationManager: its listener refers back to it. */
    private class FakeManager {
        val events = mutableListOf<String>()

        val listener = object : BootGuard.Listener {
            override fun onRollback(version: String) {
                events.add("rollback:$version")
            }

            override fun onBlockedPackage(version: String) {
                events.add("blocked-package:$version")
            }

            override fun onError(message: String, error: Throwable?) {
                events.add("error:$message")
            }
        }
    }

    /** Attaches a manager and drops every strong reference to it. */
    private fun attachManager(
        registry: BootGuardRegistry,
        create: (BootGuard.Listener) -> BootGuard
    ): WeakReference<FakeManager> {
        val manager = FakeManager()
        registry.attach("ws", manager.listener, create)
        return WeakReference(manager)
    }

    /** Best effort: asks the JVM to collect until [ref] is cleared. */
    /** System.gc() is only a hint: skip (not fail) GC-based checks on a JVM that ignores it. */
    private fun assumeGcRuns() {
        assumeTrue("the JVM did not run a requested GC", collected(WeakReference(Any())))
    }

    private fun collected(ref: WeakReference<*>): Boolean {
        repeat(50) {
            if (ref.get() == null) {
                return true
            }
            System.gc()
            Thread.sleep(10)
        }
        return ref.get() == null
    }

    private fun recordingListener(into: MutableList<String>) = object : BootGuard.Listener {
        override fun onRollback(version: String) {
            into.add("rollback:$version")
        }

        override fun onBlockedPackage(version: String) {
            into.add("blocked-package:$version")
        }

        override fun onError(message: String, error: Throwable?) {
            into.add("error:$message")
        }
    }

    @Test
    fun storageExceptionsNeverThrow() {
        storage.throwOnLoad = true
        val guard = process()

        assertEquals(BootGuard.Selection.Installed, guard.select("A"))
        assertTrue(events.any { it.startsWith("error:Cannot read") })
    }

    @Test
    fun containedFileRejectsEscapes() {
        assertNull(FileSnapshotStore.containedFile(packageDir, "../x"))
        assertNull(FileSnapshotStore.containedFile(packageDir, "a/../../x"))
        assertNull(FileSnapshotStore.containedFile(packageDir, "a\\..\\..\\x"))
        assertNull(FileSnapshotStore.containedFile(packageDir, ""))
        // Same rule as the RN plugin's getFileContent (PackagePaths), not just normalisation.
        assertNull(FileSnapshotStore.containedFile(packageDir, "/a/b.js"))
        assertNull(FileSnapshotStore.containedFile(packageDir, "\\a\\b.js"))
        assertNull(FileSnapshotStore.containedFile(packageDir, "C:\\x"))
        assertEquals(
            File(packageDir.canonicalFile, "a/b/c.js"),
            FileSnapshotStore.containedFile(packageDir, "a/b/c.js")
        )
        assertNull(snapshots.resolve("../package", INDEX))
    }

    @Test
    fun selectionStaysOnTheSnapshotWhenAnotherPackageIsInstalled() {
        install("X")
        healthyBoot("X")
        install("A")
        crashingBoot("A")
        crashingBoot("A")
        val registry = BootGuardRegistry()
        val create = { forwarding: BootGuard.Listener ->
            BootGuard(true, BINARY_1, storage, snapshots, { installedVersion }, forwarding)
        }
        val first = registry.attach("ws", listener, create).also { it.initialize() }
        val selection = first.select("A")
        assertTrue(selection is BootGuard.Selection.LastGoodSnapshot)
        first.prepareBoot(booted("X"))

        // The update task installs Z, which clears the block; then a manager is re-created.
        first.onPackageInstallStarting()
        install("Z")
        first.onPackageInstalled("Z")
        assertEquals("", storage.state!!.blocked)
        val second = registry.attach("ws", listener, create).also { it.initialize() }

        assertTrue(first === second)
        assertEquals(selection, second.select("Z"))
        assertEquals(selection, first.currentSelection())
        // The running fallback JS still reads X from the snapshot, never Z's files.
        assertEquals("index X", first.fallbackFile(INDEX)!!.readText())
        val source = BootFiles.splitSource(first.currentSelection(), INDEX, first::fallbackFile)
        assertEquals("index X", (source as BootFiles.Source.Snapshot).file!!.readText())

        // The next process boots Z.
        assertEquals(BootGuard.Selection.Installed, process().select("Z"))
    }

    @Test
    fun bundledSelectionStaysBundledWhenAnotherPackageIsInstalled() {
        install("A")
        crashingBoot("A")
        crashingBoot("A")
        val guard = process()
        assertEquals(BootGuard.Selection.Bundled, guard.select("A"))

        guard.onPackageInstallStarting()
        install("Z")
        guard.onPackageInstalled("Z")

        assertEquals(BootGuard.Selection.Bundled, guard.select("Z"))
        assertEquals(
            BootFiles.Source.Asset(INDEX),
            BootFiles.splitSource(guard.currentSelection(), INDEX, guard::fallbackFile)
        )
        assertNull(guard.fallbackFile(INDEX))
    }

    @Test
    fun throwingListenerNeverEscapesAPublicMethod() {
        install("L")
        healthyBoot("L")
        install("A")
        crashingBoot("A")
        crashingBoot("A")
        val calls = mutableListOf<String>()
        val throwing = object : BootGuard.Listener {
            override fun onRollback(version: String) {
                calls.add("rollback")
                throw IllegalStateException("listener")
            }

            override fun onBlockedPackage(version: String) {
                calls.add("blocked-package")
                throw IllegalStateException("listener")
            }

            override fun onError(message: String, error: Throwable?) {
                calls.add("error:$message")
                throw IllegalStateException("listener")
            }

            override fun onInfo(message: String) {
                calls.add("info:$message")
                throw IllegalStateException("listener")
            }
        }
        var throwOnResolve = false
        var throwOnCreate = false
        var throwOnVersion = false
        val store = object : BootGuard.SnapshotStore by snapshots {
            override fun resolve(snapshot: String, path: String): File? {
                if (throwOnResolve) {
                    throw IllegalStateException("resolve")
                }
                return snapshots.resolve(snapshot, path)
            }

            override fun create(paths: List<String>, requiredPath: String): String {
                if (throwOnCreate) {
                    throw IllegalStateException("create")
                }
                return snapshots.create(paths, requiredPath)
            }
        }
        val version = {
            if (throwOnVersion) throw IllegalStateException("version") else installedVersion
        }
        fun guard() = BootGuard(true, BINARY_1, storage, store, version, throwing)

        // initialize -> onRollback; select -> onBlockedPackage; allowPackage -> onBlockedPackage.
        val fallback = guard().also { it.initialize() }
        assertTrue(fallback.select("A") is BootGuard.Selection.LastGoodSnapshot)
        assertFalse(fallback.allowPackage("A"))
        // fallbackFile -> onError.
        throwOnResolve = true
        assertNull(fallback.fallbackFile(INDEX))
        throwOnResolve = false

        // Healthy boots of B whose snapshot is skipped (onInfo), fails (onError), cannot be
        // scheduled (onError) or cannot read the installed version (onError).
        storage.state = storage.state!!.copy(blocked = "")
        install("B")
        val skipped = guard().also { it.initialize() }
        skipped.select("B")
        skipped.prepareBoot(booted("B"))
        skipped.onPackageInstallStarting()
        skipped.markBootSuccess()
        assertEquals("", storage.state!!.pending)

        val failing = guard().also { it.initialize() }
        failing.select("B")
        failing.prepareBoot(booted("B"))
        throwOnCreate = true
        failing.markBootSuccess()
        throwOnCreate = false

        val unscheduled = guard().also { it.initialize() }
        unscheduled.select("B")
        unscheduled.prepareBoot(booted("B"))
        unscheduled.markBootSuccess { throw IllegalStateException("executor") }

        val unreadable = guard().also { it.initialize() }
        unreadable.select("B")
        unreadable.prepareBoot(booted("B"))
        throwOnVersion = true
        unreadable.markBootSuccess()
        throwOnVersion = false

        assertEquals(1, calls.count { it == "rollback" })
        assertEquals(2, calls.count { it == "blocked-package" })
        listOf(
            "error:Cannot resolve snapshot file",
            "info:Installed package changed since B booted",
            "error:Cannot snapshot package B",
            "error:Cannot schedule snapshot of B",
            "error:Cannot read the installed package version"
        ).forEach { prefix -> assertTrue(prefix, calls.any { it.startsWith(prefix) }) }
        assertEquals("L", storage.state!!.lastGood!!.version)
    }

    private class MemoryStorage : BootGuard.Storage {
        var state: BootGuard.State? = null
        var failSaves = false
        var failSavesWithLastGood = false
        var throwOnLoad = false

        override fun load(): BootGuard.State? {
            if (throwOnLoad) {
                throw IllegalStateException("corrupt")
            }
            return state
        }

        override fun save(state: BootGuard.State): Boolean {
            if (failSaves) {
                return false
            }
            if (failSavesWithLastGood && state.lastGood != this.state?.lastGood) {
                return false
            }
            this.state = state
            return true
        }

        override fun clear(): Boolean {
            state = null
            return true
        }
    }

    private companion object {
        const val INDEX = "index.android.bundle"
        const val BINARY_1 = "1.0+1"
        const val BINARY_2 = "1.1+2"
    }
}

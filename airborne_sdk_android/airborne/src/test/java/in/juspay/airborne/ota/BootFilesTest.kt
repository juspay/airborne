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

import `in`.juspay.airborne.ota.BootFiles.Source
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class BootFilesTest {
    @get:Rule
    val temp = TemporaryFolder()

    private lateinit var packageDir: File
    private lateinit var snapshotDir: File

    private val lastGood = BootGuard.Selection.LastGoodSnapshot(
        BootGuard.LastGood("L", INDEX, "config-L", "airborne-good-1")
    )

    @Before
    fun setUp() {
        packageDir = temp.newFolder("package")
        snapshotDir = temp.newFolder("snapshot")
        // The blocked package is installed; the snapshot holds the last-good one.
        File(packageDir, INDEX).writeText("index A")
        File(packageDir, "split.js").writeText("split A")
        File(snapshotDir, INDEX).writeText("index L")
    }

    private fun snapshotFile(path: String): File? =
        FileSnapshotStore.containedFile(snapshotDir, path)

    private fun installedFile(path: String): File = File(packageDir, path)

    private fun indexFilePath(selection: BootGuard.Selection?, index: String = INDEX) =
        BootFiles.indexFilePath(selection, index, ::snapshotFile, ::installedFile)

    @Test
    fun installedSelectionReadsTheInstalledPackage() {
        val expected = Source.Installed("split.js")
        assertEquals(expected, BootFiles.splitSource(BootGuard.Selection.Installed, "split.js", ::snapshotFile))
        // Guard unavailable: unchanged behaviour.
        assertEquals(expected, BootFiles.splitSource(null, "split.js", ::snapshotFile))
        assertEquals(File(packageDir, INDEX).absolutePath, indexFilePath(BootGuard.Selection.Installed))
        assertEquals(File(packageDir, INDEX).absolutePath, indexFilePath(null))
    }

    @Test
    fun lastGoodSelectionReadsOnlyTheSnapshot() {
        val index = BootFiles.splitSource(lastGood, INDEX, ::snapshotFile)
        assertEquals("index L", (index as Source.Snapshot).file!!.readText())
        assertEquals(File(snapshotDir, INDEX).canonicalPath, indexFilePath(lastGood))

        // A file missing from the snapshot is never read from the blocked package.
        val missing = BootFiles.splitSource(lastGood, "split.js", ::snapshotFile) as Source.Snapshot
        assertTrue(missing.file?.isFile != true)
        File(snapshotDir, INDEX).delete()
        assertEquals("", indexFilePath(lastGood))
    }

    @Test
    fun bundledSelectionReadsOnlyTheApkAssets() {
        assertEquals(Source.Asset("split.js"), BootFiles.splitSource(BootGuard.Selection.Bundled, "split.js", ::snapshotFile))
        // The blocked package's index exists, but the bundled boot uses the assets.
        assertEquals("", indexFilePath(BootGuard.Selection.Bundled))
    }

    @Test
    fun emptyIndexNameIsNeverThePackageDir() {
        assertTrue(installedFile("").isDirectory)
        assertEquals("", indexFilePath(BootGuard.Selection.Installed, index = ""))
        assertEquals("", indexFilePath(null, index = ""))
        assertEquals("", indexFilePath(lastGood, index = ""))
    }

    @Test
    fun missingInstalledIndexBootsTheAssets() {
        File(packageDir, INDEX).delete()
        assertEquals("", indexFilePath(BootGuard.Selection.Installed))
    }

    @Test
    fun prepareBootCountsOnlyAnExistingIndexFile() {
        val index = File(packageDir, INDEX).absolutePath
        assertEquals("A", BootFiles.trackedVersion("A", index))
        assertNull(BootFiles.trackedVersion("A", ""))
        assertNull(BootFiles.trackedVersion("A", packageDir.absolutePath))
        assertNull(BootFiles.trackedVersion(null, index))
        assertNull(BootFiles.trackedVersion("", index))
        File(index).delete()
        assertNull(BootFiles.trackedVersion("A", index))
    }

    @Test
    fun cleanUpKeepsTheDisplacedPackageSplitsAndResources() {
        val booting = BootFiles.ConfigFiles(listOf("index-L.js", "l.js"), listOf("res-L.json"))
        val installed = BootFiles.ConfigFiles(listOf("index-A.js", "a.js"), listOf("res-A.json"))
        val updated = BootFiles.ConfigFiles(listOf("index-C.js"), listOf("res-C.json"))

        val airborne = BootFiles.cleanUpKeepSet(true, booting, installed, updated)
        assertEquals(
            setOf("index-L.js", "l.js", "index-A.js", "a.js", "index-C.js", "res-L.json", "res-A.json", "res-C.json"),
            airborne.packageDir.toSet()
        )

        val legacy = BootFiles.cleanUpKeepSet(false, booting, installed, null)
        assertEquals(setOf("index-L.js", "l.js", "index-A.js", "a.js"), legacy.packageDir.toSet())
        assertEquals(setOf("res-L.json", "res-A.json"), legacy.resourcesDir.toSet())
    }

    @Test
    fun cleanUpWithoutUpdateKeepsTheDisplacedResources() {
        // Update result not Ok: nothing new, but the displaced package must survive.
        val booting = BootFiles.ConfigFiles(listOf("index-L.js"), listOf("res-L.json"))
        val installed = BootFiles.ConfigFiles(listOf("index-A.js"), listOf("res-A.json"))

        val keep = BootFiles.cleanUpKeepSet(true, booting, installed, null)

        assertTrue(keep.packageDir.containsAll(listOf("index-A.js", "res-A.json")))
    }

    private companion object {
        const val INDEX = "index.android.bundle"
    }
}

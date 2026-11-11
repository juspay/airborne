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

/**
 * Where the files of the package booting in this process come from, given the boot guard
 * [BootGuard.Selection], and which package files clean-up keeps. Plain Kotlin (no Android or
 * org.json types) so the rules can be unit tested on the JVM.
 *
 * A null selection means the boot guard is unavailable: the installed package is used.
 */
internal object BootFiles {
    sealed class Source {
        /** [path] of the installed package (relative to the package dir). */
        data class Installed(val path: String) : Source()

        /** [path] of the bundled package in the APK assets (relative to the package dir). */
        data class Asset(val path: String) : Source()

        /** The last-good snapshot copy, or null when it is missing or escapes the snapshot. */
        data class Snapshot(val file: File?) : Source()
    }

    /** The package and resource file paths of one release config. */
    data class ConfigFiles(val packageFiles: List<String>, val resourceFiles: List<String>)

    /** Files to keep in the package dir and (when not from Airborne) the resources dir. */
    data class KeepSet(val packageDir: List<String>, val resourcesDir: List<String>)

    /**
     * Never returns the installed (blocked) package while a substitute boots: a last-good boot
     * reads only its snapshot, a bundled boot only the APK assets (a rejected OTA may reuse the
     * bundled file names).
     */
    fun splitSource(
        selection: BootGuard.Selection?,
        path: String,
        snapshotFile: (String) -> File?
    ): Source = when (selection) {
        is BootGuard.Selection.LastGoodSnapshot -> Source.Snapshot(snapshotFile(path))
        BootGuard.Selection.Bundled -> Source.Asset(path)
        BootGuard.Selection.Installed, null -> Source.Installed(path)
    }

    /**
     * Absolute path of the index file to hand to the JS runtime, or "" to boot the APK assets.
     * An empty [indexPath] must not resolve to the package dir itself.
     */
    fun indexFilePath(
        selection: BootGuard.Selection?,
        indexPath: String,
        snapshotFile: (String) -> File?,
        installedFile: (String) -> File
    ): String {
        if (indexPath.isEmpty()) {
            return ""
        }
        val file = when (val source = splitSource(selection, indexPath, snapshotFile)) {
            is Source.Snapshot -> source.file
            is Source.Asset -> null
            is Source.Installed -> installedFile(source.path)
        }
        return if (file?.isFile == true) file.absolutePath else ""
    }

    /**
     * The version prepareBoot counts, or null for boots that are never tracked: bundled boots
     * and boots whose index file is missing.
     */
    fun trackedVersion(version: String?, indexFilePath: String): String? {
        if (version.isNullOrEmpty() || indexFilePath.isEmpty()) {
            return null
        }
        return if (File(indexFilePath).isFile) version else null
    }

    /**
     * Clean-up keeps the booting package, the installed package it may have displaced (a
     * substitute boots while the blocked one stays installed) and the update just installed.
     * With [fromAirborne] resources live in the package dir.
     */
    fun cleanUpKeepSet(
        fromAirborne: Boolean,
        booting: ConfigFiles?,
        installed: ConfigFiles?,
        updated: ConfigFiles?
    ): KeepSet {
        val configs = listOfNotNull(booting, installed, updated)
        val packageFiles = configs.flatMap { it.packageFiles }.distinct()
        val resourceFiles = configs.flatMap { it.resourceFiles }.distinct()
        return if (fromAirborne) {
            KeepSet((packageFiles + resourceFiles).distinct(), emptyList())
        } else {
            KeepSet(packageFiles, resourceFiles)
        }
    }
}

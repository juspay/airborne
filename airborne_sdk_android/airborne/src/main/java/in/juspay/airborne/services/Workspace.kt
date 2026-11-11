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

/* Class for maintaining a `namespace` through the application.
 * The main functionality provided is to open files & read/write
 * shared-preferences according to a particular namespace.
 */
package `in`.juspay.airborne.services

import android.content.Context
import android.content.SharedPreferences
import android.content.res.AssetManager
import android.util.Log
import androidx.annotation.Keep
import `in`.juspay.airborne.utils.OTAUtils
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.ConcurrentHashMap

@Keep
open class Workspace {
    val path: String
    var root: File
    val cacheRoot: File
    private val sharedPrefsName: String
    private val sharedPrefsList: List<SharedPreferences>
    private val scopedSharedPrefs: ConcurrentHashMap<String, SharedPreferences>
    private val appContext: Context
    private val assetManager: AssetManager
    private val fromAirborne: Boolean

    constructor(ctx: Context, workspacePath: String, fromAirborne: Boolean = false) {
        this.path = trimFileSeparator(workspacePath)
        this.fromAirborne = fromAirborne
        root = mkRoot(ctx, this.path)
        cacheRoot = mkCacheRoot(ctx, this.path)
        sharedPrefsName = this.path.replace('/', '_')
        assetManager = ctx.assets
        val spl = ArrayList<SharedPreferences>()
        if (fallbackSharedPreferencesJuspay == null) {
            fallbackSharedPreferencesJuspay = ctx
                .getSharedPreferences("juspay", Context.MODE_PRIVATE)
        }
        if (fallbackSharedPreferencesGodel == null) {
            fallbackSharedPreferencesGodel = ctx
                .getSharedPreferences("godel", Context.MODE_PRIVATE)
        }
        if (path == FALLBACK_WORKSPACE) {
            fallbackSharedPreferencesJuspay?.let { spl.add(it) }
            fallbackSharedPreferencesGodel?.let { spl.add(it) }
        } else {
            spl.add(ctx.getSharedPreferences(sharedPrefsName, Context.MODE_PRIVATE))
            fallbackSharedPreferencesJuspay?.let { spl.add(it) }
            fallbackSharedPreferencesGodel?.let { spl.add(it) }
        }
        sharedPrefsList = spl
        scopedSharedPrefs = ConcurrentHashMap()
        appContext = ctx.applicationContext ?: ctx
    }

    protected constructor(workspace: Workspace) {
        path = workspace.path
        fromAirborne = workspace.fromAirborne
        root = workspace.root
        cacheRoot = workspace.cacheRoot
        sharedPrefsName = workspace.sharedPrefsName
        sharedPrefsList = workspace.sharedPrefsList
        scopedSharedPrefs = workspace.scopedSharedPrefs
        appContext = workspace.appContext
        assetManager = workspace.assetManager
    }

    fun clean(ctx: Context) {
        if (root.exists()) {
            OTAUtils.deleteRecursive(root)
            mkRoot(ctx, path)
            setup(ctx)
        }
    }

    fun open(filePath: String): File = open(root, filePath)

    fun openInCache(filePath: String): File = open(cacheRoot, filePath)

    private fun open(root: File, filePath: String) =
        File(root, trimFileSeparator(filePath))

    @Throws(IOException::class)
    fun openAsset(filePath: String): InputStream {
        val trimmed = trimFileSeparator(filePath)
        return try {
            assetManager.open("$path/$trimmed")
        } catch (e: IOException) {
            if (path != FALLBACK_WORKSPACE) {
                Log.d(TAG, "$e, trying fallback workspace.")
                if (fromAirborne) {
                    assetManager.open("airborne/$trimmed")
                } else {
                    assetManager.open("$FALLBACK_WORKSPACE/$trimmed")
                }
            } else {
                throw e
            }
        }
    }

    fun isInSharedPreference(key: String?): Boolean {
        for (sharedPref in sharedPrefsList) {
            if (sharedPref.contains(key)) {
                return true
            }
        }
        return false
    }

    fun getFromSharedPreference(key: String?, default: String?): String? {
        for (sharedPref in sharedPrefsList) {
            sharedPref.getString(key, null)?.let {
                return it
            }
        }
        return default
    }

    fun writeToSharedPreference(key: String?, value: String?): Unit? = key?.let {
        sharedPrefsList[0].edit()
            .putString(it, value)
            .apply()
    }

    fun removeFromSharedPreference(key: String?): Unit? = key?.let {
        for (sharedPref in sharedPrefsList) {
            sharedPref.edit()?.remove(it)?.apply()
        }
    }

    // Each scope is its own prefs file, so keys kept there neither grow nor force a load of the main file.
    fun getFromSharedPreference(key: String?, default: String?, scope: String): String? =
        scopedSharedPreference(scope).getString(key, default)

    fun writeToSharedPreference(key: String?, value: String?, scope: String): Unit? = key?.let {
        scopedSharedPreference(scope).edit()
            .putString(it, value)
            .apply()
    }

    fun removeFromSharedPreference(key: String?, scope: String): Unit? = key?.let {
        scopedSharedPreference(scope).edit().remove(it).apply()
    }

    private fun scopedSharedPreference(scope: String): SharedPreferences {
        require(SCOPE_PATTERN.matches(scope)) { "Invalid shared preference scope: $scope" }
        return scopedSharedPrefs.getOrPut(scope) {
            appContext.getSharedPreferences("$sharedPrefsName.$scope", Context.MODE_PRIVATE)
        }
    }

    fun getKeysInSharedPreference(): Set<String> {
        val keysSet = HashSet<String>()
        for (sharedPref in sharedPrefsList) {
            keysSet.addAll(sharedPref.all.keys)
        }
        return keysSet
    }

    fun copyAssetsRecursively(context: Context, assetPath: String, destRoot: File) {
        val assetManager = context.assets
        val fileList = assetManager.list(assetPath) ?: return

        if (fileList.isEmpty()) {
            // It's a file, copy it
            copyAssetFile(context, assetPath, destRoot)
        } else {
            // It's a folder
            val destDir = File(destRoot, assetPath.substringAfterLast('/'))
            if (!destDir.exists()) destDir.mkdirs()

            for (name in fileList) {
                val subPath = if (assetPath.isEmpty()) name else "$assetPath/$name"
                copyAssetsRecursively(context, subPath, destDir)
            }
        }
    }

    private fun copyAssetFile(context: Context, assetPath: String, destDir: File) {
        val fileName = assetPath.substringAfterLast('/')
        val outFile = File(destDir, fileName)
        context.assets.open(assetPath).use { input ->
            FileOutputStream(outFile).use { output ->
                input.copyTo(output)
            }
        }
    }

    fun setup(context: Context) {
        copyAssetsRecursively(context, path, root)
    }

    companion object {
        // Keys read while the SDK boots; keep it small, it is loaded on every startup.
        const val BOOTUP_PREFS_SCOPE = "bootup_prefs"

        private const val TAG = "Workspace"
        private const val FALLBACK_WORKSPACE = "juspay"
        private val SCOPE_PATTERN = Regex("[A-Za-z0-9_]{1,32}")

        private var fallbackSharedPreferencesJuspay: SharedPreferences? = null
        private var fallbackSharedPreferencesGodel: SharedPreferences? = null

        protected fun trimFileSeparator(path: String) =
            path.trim(' ', '/')

        private fun mkRoot(ctx: Context, workspacePath: String): File {
            if (workspacePath.contains("/")) {
                val i = workspacePath.indexOf('/')
                val rootDirName = workspacePath.substring(0, i)
                val rootDir = ctx.getDir(rootDirName, Context.MODE_PRIVATE)
                val workspaceDir = File(rootDir, workspacePath.substring(i + 1))
                if (!workspaceDir.exists()) {
                    workspaceDir.mkdirs()
                }

                return workspaceDir
            } else {
                return ctx.getDir(workspacePath, Context.MODE_PRIVATE)
            }
        }

        private fun mkCacheRoot(ctx: Context, workspacePath: String): File {
            val cacheRoot = File(ctx.cacheDir, workspacePath)
            if (!cacheRoot.exists()) {
                cacheRoot.mkdirs()
            }
            return cacheRoot
        }
    }
}

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

package `in`.juspay.hyperota.ota

import android.content.Context
import android.content.res.AssetManager
import android.util.Log
import `in`.juspay.hyperota.TrackerCallback
import `in`.juspay.hyperota.R
import `in`.juspay.hyperota.services.FileProviderService
import java.io.FileOutputStream
import java.io.IOException

/**
 * Utility class for handling asset operations in the OTA service.
 * Responsible for copying assets from the app bundle to the OTA directory.
 */
internal class AssetUtils(
    private val context: Context,
    private val fileProviderService: FileProviderService,
    private val tracker: TrackerCallback
) {
    private val assetManager: AssetManager = context.assets
    private val tag = "AssetUtils"
    
    // Debug flag to control verbose logging
    private val enableDebugLogs = true // Set to true for detailed debugging

    private fun logDebug(message: String) {
        if (enableDebugLogs) Log.d(tag, message)
    }
    
    private fun logVerbose(message: String) {
        if (enableDebugLogs) Log.v(tag, message)
    }
    
    private fun logInfo(message: String) {
        Log.i(tag, message)
    }
    
    private fun logWarning(message: String) {
        Log.w(tag, message)
    }
    
    private fun logError(message: String, throwable: Throwable? = null) {
        if (throwable != null) {
            Log.e(tag, message, throwable)
        } else {
            Log.e(tag, message)
        }
    }

    /**
     * Copy assets from the app bundle to the OTA directory based on release config.
     * 
     * @param releaseConfig The release configuration containing asset paths
     * @param destinationDir The destination directory relative to workspace
     * @return AssetCopyResult indicating success, partial success, or error
     */
    internal fun copyAssetsFromBundle(releaseConfig: ReleaseConfig, destinationDir: String): AssetCopyResult {
        val startTime = System.currentTimeMillis()
        
        try {
            logDebug("Starting asset copy operation")
            val requiredAssetPaths = extractRequiredAssetPaths(releaseConfig)
            logDebug("Required assets: ${requiredAssetPaths.size}")
            
            if (requiredAssetPaths.isEmpty()) {
                logDebug("No assets required for copying")
                return AssetCopyResult.Success(0)
            }
            
            val availableAssets = discoverAvailableAssets()
            logDebug("Available assets discovered: ${availableAssets.size}")
            
            val matchedAssets = matchAssetPaths(requiredAssetPaths, availableAssets)
            logDebug("Matched assets: ${matchedAssets.size}")
            
            val copyResult = copyMatchedAssets(matchedAssets, destinationDir)
            
            val timeTaken = System.currentTimeMillis() - startTime
            logDebug("Asset copy operation completed in ${timeTaken}ms")
            
            return copyResult
            
        } catch (e: Exception) {
            logError("Exception during asset copy operation", e)
            return AssetCopyResult.Error("Asset copy failed: ${e.message}")
        }
    }

    /**
     * Extract required asset paths from the release configuration.
     */
    private fun extractRequiredAssetPaths(releaseConfig: ReleaseConfig): List<String> {
        val assetPaths = mutableListOf<String>()
        
        releaseConfig.resources.forEach { resource ->
            assetPaths.add(resource.filePath)
        }
        
        releaseConfig.pkg?.filePaths?.forEach { filePath ->
            assetPaths.add(filePath)
        }
        
        logDebug("Extracted ${assetPaths.size} asset paths from release config (resources + package filePaths)")
        return assetPaths
    }

    /**
     * Discover all available assets in the app bundle.
     */
    private fun discoverAvailableAssets(): List<String> {
        val assets = mutableSetOf<String>() // Use Set to prevent duplicates
        
        try {
            logDebug("Starting asset discovery...")
            
            logDebug("Scanning assets/ directory...")
            scanAssetsRecursively("", assets)
            
            try {
                scanAssetsRecursively("res", assets)
            } catch (e: IOException) {
                logDebug("No res directory found in assets, skipping")
            }
            
            logDebug("Scanning Android resources...")
            scanAndroidResources(assets)
            
            val assetList = assets.toList()
            
            logInfo("Asset discovery completed: ${assetList.size} assets found")
            
            if (enableDebugLogs) {
                logDebug("=== DISCOVERED ASSETS (${assetList.size} total) ===")
                assetList.forEachIndexed { index, assetPath ->
                    logDebug("Asset ${index + 1}: $assetPath")
                }
                logDebug("=== END OF DISCOVERED ASSETS ===")
            }
            return assetList
            
        } catch (e: Exception) {
            logError("Error discovering assets", e)
            return emptyList()
        }
    }

    /**
     * Scan Android resources (res/drawable, res/raw, etc.) using reflection.
     */
    private fun scanAndroidResources(assets: MutableSet<String>) {
        val res = context.resources
        val packageName = context.packageName

        logDebug("Scanning drawable resources...")
        val drawableFields = getResFields("drawable", packageName)
        logDebug("Found ${drawableFields.size} drawable fields")

        drawableFields.forEach { field ->
            try {
                val resId = field.getInt(null)
                val resName = getResourceNameWithExtension(resId, res)
                val resType = res.getResourceTypeName(resId)
                val resourcePath = "res/$resType/$resName"
                if (assets.add(resourcePath)) {
                    logDebug("Added drawable resource: $resourcePath")
                }
            } catch (e: Exception) {
                logError("Error scanning drawable resource", e)
            }
        }

        logDebug("Scanning raw resources...")
        val rawFields = getResFields("raw", packageName)
        logDebug("Found ${rawFields.size} raw fields")

        getResFields("raw", packageName).forEach { field ->
            try {
                val resId = field.getInt(null)
                val resName = getResourceNameWithExtension(resId, res)
                val resType = res.getResourceTypeName(resId)
                val resourcePath = "res/$resType/$resName"
                if (assets.add(resourcePath)) {
                    logDebug("Added raw resource: $resourcePath")
                }
            } catch (e: Exception) {
                logError("Error scanning raw resource", e)
            }
        }
    }

    /**
     * Get resource name with proper extension using TypedValue.
     */
    private fun getResourceNameWithExtension(resId: Int, resources: android.content.res.Resources): String {
        val value = android.util.TypedValue()
        resources.getValue(resId, value, true)
        val resName = value.string.toString()
        return resName.split('/').last()
    }

    /**
     * Get resource fields from R class.
     */
    private fun getResFields(resClassName: String, packageName: String): Array<java.lang.reflect.Field> {
        try {
            logDebug("Getting R.$resClassName fields from airborne R class")
            val rClass = R::class.java
            val nestedClasses = rClass.classes
            val resClass = nestedClasses.find { it.simpleName == resClassName }
            if (resClass != null) {
                logDebug("Found R.$resClassName class in airborne with ${resClass.fields.size} fields")
                return resClass.fields
            } else {
                logWarning("R.$resClassName class not found in airborne")
            }
        } catch (e: Exception) {
            logError("Could not get R.$resClassName fields from airborne R class", e)
        }

        return emptyArray()
    }

    /**
     * Recursively scan assets directory.
     */
    private fun scanAssetsRecursively(path: String, assets: MutableSet<String>) {
        try {
            val files = assetManager.list(path) ?: return
            
            for (file in files) {
                val fullPath = if (path.isEmpty()) file else "$path/$file"
                
                try {
                    val subFiles = assetManager.list(fullPath)
                    if (subFiles != null && subFiles.isNotEmpty()) {
                        scanAssetsRecursively(fullPath, assets)
                    } else {
                        if (assets.add(fullPath)) { // add() returns true if element was added (not duplicate)
                            logVerbose("Added asset: $fullPath [FROM ASSETS]")
                        }
                    }
                } catch (e: IOException) {
                    if (assets.add(fullPath)) { // add() returns true if element was added (not duplicate)
                        logVerbose("Added asset: $fullPath [FROM ASSETS]")
                    }
                }
            }
        } catch (e: IOException) {
            logError("Error scanning assets path: $path", e)
        }
    }

    /**
     * Match required asset paths with available assets.
     */
    private fun matchAssetPaths(requiredPaths: List<String>, availableAssets: List<String>): List<String> {
        val matchedAssets = mutableListOf<String>()
        
        for (requiredPath in requiredPaths) {
            if (availableAssets.contains(requiredPath)) {
                matchedAssets.add(requiredPath)
                logDebug("Exact match found: $requiredPath")
                continue
            }
            
            val partialMatches = availableAssets.filter { it.endsWith(requiredPath) || it.contains(requiredPath) }
            if (partialMatches.isNotEmpty()) {
                matchedAssets.addAll(partialMatches)
                logDebug("Partial matches found for $requiredPath: ${partialMatches.size}")
                continue
            }
            
            logWarning("No match found for required asset: $requiredPath")
        }
        
        return matchedAssets.distinct()
    }

    /**
     * Copy matched assets to the destination directory.
     */
    private fun copyMatchedAssets(matchedAssets: List<String>, destinationDir: String): AssetCopyResult {
        var successCount = 0
        val failures = mutableListOf<String>()
        
        for (assetPath in matchedAssets) {
            try {
                if (copyAsset(assetPath, destinationDir)) {
                    successCount++
                    logDebug("Successfully copied: $assetPath")
                } else {
                    failures.add(assetPath)
                    logWarning("Failed to copy: $assetPath")
                }
            } catch (e: Exception) {
                failures.add(assetPath)
                logError("Exception copying asset: $assetPath", e)
            }
        }
        
        return when {
            failures.isEmpty() -> AssetCopyResult.Success(successCount)
            successCount > 0 -> AssetCopyResult.PartialSuccess(successCount, failures.size, failures)
            else -> AssetCopyResult.Error("Failed to copy any assets")
        }
    }

    /**
     * Copy a single asset to the destination directory.
     */
    private fun copyAsset(assetPath: String, destinationDir: String): Boolean {
        try {
            val destinationFile = fileProviderService.getFileFromInternalStorage("$destinationDir/$assetPath")
            
            destinationFile.parentFile?.mkdirs()
            
            if (assetPath.startsWith("res/")) {
                return copyAndroidResource(assetPath, destinationFile)
            } else {
                assetManager.open(assetPath).use { inputStream ->
                    FileOutputStream(destinationFile).use { outputStream ->
                        inputStream.copyTo(outputStream, 4096)
                    }
                }
            }
            
            return true
            
        } catch (e: Exception) {
            logError("Error copying asset: $assetPath", e)
            return false
        }
    }

    /**
     * Copy an Android resource to the destination.
     */
    private fun copyAndroidResource(resourcePath: String, destinationFile: java.io.File): Boolean {
        try {
            val pathParts = resourcePath.split("/")
            if (pathParts.size < 3) return false
            
            val resourceType = pathParts[1]
            val resourceName = pathParts[2].substringBeforeLast(".") // Remove extension
            
            val resourceId = context.resources.getIdentifier(resourceName, resourceType, context.packageName)
            if (resourceId == 0) {
                logWarning("Could not find resource ID for: $resourcePath")
                return false
            }
            
            context.resources.openRawResource(resourceId).use { inputStream ->
                java.io.FileOutputStream(destinationFile).use { outputStream ->
                    inputStream.copyTo(outputStream, 4096)
                }
            }
            
            return true
            
        } catch (e: Exception) {
            logError("Error copying Android resource: $resourcePath", e)
            return false
        }
    }

    /**
     * Sealed class representing the result of asset copy operation.
     */
    sealed class AssetCopyResult {
        data class Success(val successCount: Int) : AssetCopyResult()
        data class PartialSuccess(val successCount: Int, val failureCount: Int, val failures: List<String>) : AssetCopyResult()
        data class Error(val message: String) : AssetCopyResult()
    }
} 
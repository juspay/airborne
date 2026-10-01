//
//  AJPApplicationManagerUtils.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation
#if SWIFT_PACKAGE
import AirborneSwiftCore
import AirborneSwiftModel
import AirborneObjC
#endif

@objc public enum AJPDownloadStatus: Int {
    case downloading
    case completed
    case failed
    case timeout
}

/// A pure Swift utility class extracted from AJPApplicationManager to handle IO, strings, and mappings.
class AJPApplicationManagerUtils {
    
    // Dependencies
    private let fileUtil: AJPFileUtil
    private let tracker: AJPApplicationTracker
    private let remoteFileUtil: AJPRemoteFileUtil
    
    init(fileUtil: AJPFileUtil, tracker: AJPApplicationTracker, remoteFileUtil: AJPRemoteFileUtil) {
        self.fileUtil = fileUtil
        self.tracker = tracker
        self.remoteFileUtil = remoteFileUtil
    }
    
    // MARK: - Temp Directory Handlers
    
    func prepareTempDirectory() {
        cleanupTempDirectory()
        let tempDirPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.JUSPAY_TEMP_DIR, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        fileUtil.createFolderIfDoesNotExist(tempDirPath)
    }
    
    func cleanupTempDirectory() {
        let tempDirPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.JUSPAY_TEMP_DIR, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: tempDirPath) {
            try? fileManager.removeItem(atPath: tempDirPath)
        }
    }

    func cleanupPackageDirectory() {
        fileUtil.cleanupEntireDirectory(AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
    }

    func cleanupManifestDirectory() {
        fileUtil.cleanupEntireDirectory(AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
    }

    // MARK: - File System Helpers
    
    func getAllFilesInDirectory(_ directory: String, subFolder: String, includeSubfolders: Bool) -> [String] {
        let directoryPath = fileUtil.fullPathInStorageForFilePath(subFolder, inFolder: directory)
        let fileManager = FileManager.default
        var isDirectory: ObjCBool = false
        if !fileManager.fileExists(atPath: directoryPath, isDirectory: &isDirectory) || !isDirectory.boolValue {
            return []
        }
        
        if includeSubfolders {
            var files: [String] = []
            if let enumerator = fileManager.enumerator(atPath: directoryPath) {
                for case let relativePath as String in enumerator {
                    let fullPath = (directoryPath as NSString).appendingPathComponent(relativePath)
                    var isDir: ObjCBool = false
                    if fileManager.fileExists(atPath: fullPath, isDirectory: &isDir), !isDir.boolValue {
                        files.append(relativePath)
                    }
                }
            }
            return files
        } else {
            guard let fileNames = try? fileManager.contentsOfDirectory(atPath: directoryPath) else {
                return []
            }
            var files: [String] = []
            for fileName in fileNames {
                let fullPath = (directoryPath as NSString).appendingPathComponent(fileName)
                var isDir: ObjCBool = false
                if fileManager.fileExists(atPath: fullPath, isDirectory: &isDir), !isDir.boolValue {
                    files.append(fileName)
                }
            }
            return files
        }
    }
    
    func deleteFile(_ fileName: String, subFolder: String, inFolder folder: String) {
        let filePath = (subFolder as NSString).appendingPathComponent(fileName)
        do {
            try fileUtil.deleteFile(filePath, inFolder: folder)
        } catch {
            let errString = error.localizedDescription
            let value = NSMutableDictionary()
            value["file_name"] = filePath
            value["error"] = errString
            tracker.trackError("delete_failed", value: value)
        }
    }
    
    // MARK: - Resources and Strings
    
    /// Filters `newSplits` down to the ones that actually need downloading.
    ///
    /// - Parameter requiringPresenceInMain: also queue a split whose file is missing from the
    ///   package's `main` directory. Pass `true` for important splits, whose installation is
    ///   gated on the file being present; leave it `false` for lazy splits, which are absent
    ///   from disk until they are downloaded and track that through `isDownloaded`.
    func getResourcesFrom(_ newSplits: [AJPResource], filtering currentSplits: [AJPResource], isFirstRunAfterInstallation: Bool, requiringPresenceInMain: Bool = false) -> [AJPResource] {
        if isFirstRunAfterInstallation {
            return newSplits
        }

        var currentResourcesDict: [String: AJPResource] = [:]
        for currentResource in currentSplits {
            currentResourcesDict[currentResource.filePath] = currentResource
        }

        // Listed once up front rather than stat-ing per split. Comparing manifests cannot tell
        // whether a file survived on disk, and a split that is missing from main/ will never be
        // re-fetched by the diff alone — `isAppInstalled` then rejects the package on this and
        // every later boot, pinning the app to its current version for good.
        var filesInMain = Set<String>()
        if requiringPresenceInMain {
            filesInMain = Set(getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
                                                     subFolder: AJPApplicationConstants.JUSPAY_MAIN_DIR,
                                                     includeSubfolders: true))
        }

        return newSplits.filter { newResource in
            let currentResource = currentResourcesDict[newResource.filePath]
            if shouldDownloadResource(newResource, existingResource: currentResource) {
                return true
            }

            guard requiringPresenceInMain else { return false }

            // Either name counts as present: the downloader writes `filePath` verbatim while
            // `isAppInstalled` looks for the `.jsa` -> `.js` form, and honouring only one of them
            // would re-download such a split on every single boot.
            return !filesInMain.contains(newResource.filePath)
                && !filesInMain.contains(jsFileName(for: newResource.filePath))
        }
    }
    
    private func shouldDownloadResource(_ resourceToBeDownloaded: AJPResource?, existingResource: AJPResource?) -> Bool {
        guard let existing = existingResource else { return true }
        guard let newResource = resourceToBeDownloaded else { return false }
        
        if newResource.url.absoluteString != existing.url.absoluteString {
            return true
        }
        
        let newChecksum = newResource.checksum
        let existingChecksum = existing.checksum
        
        if let newCheck = newChecksum, !newCheck.isEmpty,
           let existCheck = existingChecksum, !existCheck.isEmpty {
            return newCheck != existCheck
        }
        
        return true
    }
    
    func jsFileName(for fileName: String) -> String {
        return fileName.replacingOccurrences(of: ".jsa", with: ".js")
    }
    
    func getResponseCode(from response: URLResponse?) -> Int {
        if let httpResponse = response as? HTTPURLResponse {
            return httpResponse.statusCode
        }
        return -1
    }
    
    func getStatusString(_ status: AJPDownloadStatus) -> String {
        switch status {
        case .downloading: return "DOWNLOADING"
        case .completed: return "COMPLETED"
        case .failed: return "FAILED"
        case .timeout: return "TIMEOUT"
        @unknown default: return ""
        }
    }
    
    func isDownloadCompleted(_ status: AJPDownloadStatus) -> Bool {
        return status != .downloading
    }
    
    func sanitizedError(_ error: String?) -> String {
        return error ?? "Unknown error"
    }
    
    func dictionaryFromResources(_ resources: [AJPResource]) -> NSMutableDictionary {
        let dictionary = NSMutableDictionary()
        for resource in resources {
            dictionary[resource.filePath] = resource
        }
        return dictionary
    }
    
    // MARK: - Package File Operations

    func movePackageFromTempToMain(_ fileName: String) throws {
        let tempFilePath = (AJPApplicationConstants.JUSPAY_TEMP_DIR as NSString).appendingPathComponent(fileName)
        let mainFilePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(fileName)

        let tempPath = fileUtil.fullPathInStorageForFilePath(tempFilePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        let mainPath = fileUtil.fullPathInStorageForFilePath(mainFilePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: mainPath) {
            try fileManager.removeItem(atPath: mainPath)
        }
        try fileManager.moveItem(atPath: tempPath, toPath: mainPath)
    }

    @discardableResult
    func movePackageFromTempToMain(_ fileName: String, error: inout NSError?) -> Bool {
        do {
            try movePackageFromTempToMain(fileName)
            return true
        } catch let err as NSError {
            error = err
            return false
        }
    }

    func moveAllPackagesFromTempToMain() {
        let tempDirPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.JUSPAY_TEMP_DIR, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: tempDirPath, isDirectory: &isDirectory), isDirectory.boolValue else {
            let map = NSMutableDictionary()
            map["error"] = "Could not read temp directory"
            tracker.trackError("temp_directory_read_failed", value: map)
            return
        }

        // Enumerated recursively so every entry handed to `movePackageFromTempToMain` is a file.
        // Moving a top-level entry instead would hand it a *directory*, and that call deletes the
        // destination before moving: `main/assets` would lose every file this update's delta did
        // not re-download. This is the enumeration `handleTempPackageInstallation` already uses
        // when installing a package staged after a boot timeout.
        let tempFiles = getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
                                               subFolder: AJPApplicationConstants.JUSPAY_TEMP_DIR,
                                               includeSubfolders: true)

        var movedCount = 0
        for fileName in tempFiles {
            do {
                try movePackageFromTempToMain(fileName)
                movedCount += 1
            } catch {
                let map = NSMutableDictionary()
                map["file"] = fileName
                map["error"] = error.localizedDescription
                tracker.trackError("file_move_failed", value: map)
            }
        }

        // Reported once with a count rather than once per file: a package can carry hundreds of
        // nested assets and this runs on the boot path. Failures are still logged individually.
        let map = NSMutableDictionary()
        map["count"] = NSNumber(value: movedCount)
        map["total"] = NSNumber(value: tempFiles.count)
        tracker.trackInfo("file_moved_to_main", value: map)
    }

    func moveResourceToMain(_ resource: AJPResource) {
        let fileManager = FileManager.default
        let fileNameOnDisk = jsFileName(for: resource.filePath)

        let sourcePath = fileUtil.fullPathInStorageForFilePath(fileNameOnDisk, inFolder: AJPApplicationConstants.JUSPAY_RESOURCE_DIR)
        let destFilePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(fileNameOnDisk)
        let destPath = fileUtil.fullPathInStorageForFilePath(destFilePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        if fileManager.fileExists(atPath: destPath) {
            do {
                try fileManager.removeItem(atPath: destPath)
            } catch {
                let map = NSMutableDictionary()
                map["resource"] = resource.filePath
                map["error"] = error.localizedDescription
                tracker.trackError("resource_dest_cleanup_failed", value: map)
                return
            }
        }

        do {
            try fileManager.moveItem(atPath: sourcePath, toPath: destPath)
        } catch {
            let map = NSMutableDictionary()
            map["resource"] = resource.filePath
            map["error"] = error.localizedDescription
            tracker.trackError("resource_move_to_main_failed", value: map)
        }
    }

    func isAppInstalled(withPackage package: AJPApplicationPackage, inSubFolder subFolder: String) -> Bool {
        let downloadedFileNames = getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_PACKAGE_DIR, subFolder: subFolder, includeSubfolders: true)

        for split in package.allImportantSplits() {
            let fileNameOnDisk = jsFileName(for: split.filePath)
            if !downloadedFileNames.contains(fileNameOnDisk) {
                let map = NSMutableDictionary()
                map["file_missing"] = split.filePath
                tracker.trackInfo("package_install_failed", value: map)
                return false
            }
        }
        return true
    }

    // MARK: - Temp Manifest I/O

    func saveManifestToTemp(_ manifest: AJPApplicationManifest) {
        do {
            try fileUtil.writeInstance(manifest, fileName: AJPApplicationConstants.APP_MANIFEST_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
            let map = NSMutableDictionary()
            map["config_version"] = manifest.config.version
            map["package_version"] = manifest.package.version
            tracker.trackInfo("manifest_saved_to_temp", value: map)
        } catch {
            let map = NSMutableDictionary()
            map["error"] = error.localizedDescription
            tracker.trackError("manifest_temp_save_failed", value: map)
        }
    }

    func readTempManifest() -> AJPApplicationManifest? {
        let tempManifestPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_MANIFEST_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        guard FileManager.default.fileExists(atPath: tempManifestPath) else { return nil }

        do {
            let decoded = try fileUtil.getDecodedInstanceForClass(AJPApplicationManifest.self, withContentOfFileName: AJPApplicationConstants.APP_MANIFEST_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationManifest
            return decoded
        } catch {
            let map = NSMutableDictionary()
            map["error"] = error.localizedDescription
            tracker.trackError("temp_manifest_read_failed", value: map)
            return nil
        }
    }

    func deleteTempManifest() {
        let tempManifestPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_MANIFEST_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        guard FileManager.default.fileExists(atPath: tempManifestPath) else { return }
        try? deleteFile(AJPApplicationConstants.APP_MANIFEST_DATA_TEMP_FILE_NAME, subFolder: "", inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
    }

    // MARK: - Temp Package Staging

    func updatePackageInTemp(_ package: AJPApplicationPackage) {
        let map = NSMutableDictionary()
        map["trying_to_install_temp_package"] = "New app version downloaded in temp, installing to disk. \(package.version)"
        tracker.trackInfo("app_update_result", value: map)
        do {
            try fileUtil.writeInstance(package, fileName: AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        } catch {
            let errMap = NSMutableDictionary()
            errMap["error"] = error.localizedDescription
            errMap["result"] = "FAILED"
            errMap["file_name"] = AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME
            tracker.trackInfo("package_update_result", value: errMap)
        }
    }

    // MARK: - Resource File Preparation

    func handleResourceFilePreparationForDownload() {
        if doesCurrentResourceFileExist() {
            tracker.trackInfo("moving_current_resources_as_old", value: NSMutableDictionary())
            if !moveCurrentResourceFileAsOld() {
                tracker.trackError("resources_move_failed", value: NSMutableDictionary(dictionary: ["error": "Unknown"]))
            }
        } else {
            createEmptyOldResourceFile()
        }
    }

    private func doesCurrentResourceFileExist() -> Bool {
        let path = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        return FileManager.default.fileExists(atPath: path)
    }

    @discardableResult
    private func moveCurrentResourceFileAsOld() -> Bool {
        let fileManager = FileManager.default
        let currentPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        let oldPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_OLD_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)

        if fileManager.fileExists(atPath: oldPath) {
            try? fileManager.removeItem(atPath: oldPath)
        }

        do {
            try fileManager.moveItem(atPath: currentPath, toPath: oldPath)
            return true
        } catch {
            return false
        }
    }

    private func createEmptyOldResourceFile() {
        let emptyResources = AJPApplicationResources()
        emptyResources.resources = [:]
        try? fileUtil.writeInstance(emptyResources, fileName: AJPApplicationConstants.APP_OLD_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
    }

    func loadOldResourcesForComparison() -> [String: AJPResource] {
        guard let decoded = try? fileUtil.getDecodedInstanceForClass(AJPApplicationResources.self, withContentOfFileName: AJPApplicationConstants.APP_OLD_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationResources else {
            return [:]
        }
        return decoded.resources
    }

    func filterResourcesForDownloadUsingOld(_ oldResources: [String: AJPResource], newResources: [String: AJPResource]) -> [AJPResource] {
        return newResources.compactMap { (_, newResource) -> AJPResource? in
            shouldDownloadResource(newResource, existingResource: oldResources[newResource.filePath]) ? newResource : nil
        }
    }

    // MARK: - Networking

    func downloadFileFromURL(_ resourceURL: URL, andSaveInFilePath filePath: String, inFolder folderName: String, checksum: String?) async throws {
        let startTime = Date().timeIntervalSince1970 * 1000
        let storagePath = fileUtil.fullPathInStorageForFilePath(filePath, inFolder: folderName)
        let (status, _, errorString, _) = await remoteFileUtil.downloadFile(from: resourceURL.absoluteString, andSaveFileAtUrl: storagePath, checksum: checksum)
        
        if status {
            let logVal = NSMutableDictionary()
            logVal["url"] = resourceURL.absoluteString
            logVal["timeTaken"] = (Date().timeIntervalSince1970 * 1000) - startTime
            tracker.trackInfo("file_download", value: logVal)
        } else {
            var err = errorString
            if err == nil || err?.isEmpty == true {
                err = "Couldn't download file"
            }
            let logData = NSMutableDictionary()
            logData["url"] = resourceURL.absoluteString
            logData["error"] = err
            tracker.trackError("fetch_failed", value: logData)
            throw NSError(domain: "in.juspay.Airborne", code: 1, userInfo: [NSLocalizedDescriptionKey: err ?? ""])
        }
    }
}

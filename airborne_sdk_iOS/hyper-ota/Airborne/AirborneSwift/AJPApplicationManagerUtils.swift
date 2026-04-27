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
    
    func deleteFile(_ fileName: String, subFolder: String, inFolder folder: String) throws {
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
    
    func getResourcesFrom(_ newSplits: [AJPResource], filtering currentSplits: [AJPResource], isFirstRunAfterInstallation: Bool) -> [AJPResource] {
        if isFirstRunAfterInstallation {
            return newSplits
        }
        
        var currentResourcesDict: [String: AJPResource] = [:]
        for currentResource in currentSplits {
            currentResourcesDict[currentResource.filePath] = currentResource
        }
        
        return newSplits.filter { newResource in
            let currentResource = currentResourcesDict[newResource.filePath]
            return shouldDownloadResource(newResource, existingResource: currentResource)
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
    
    // MARK: - Networking
    
    func downloadFileFromURL(_ resourceURL: URL, andSaveInFilePath filePath: String, inFolder folderName: String, checksum: String?, completionHandler: @escaping (Error?) -> Void) {
        
        let startTime = Date().timeIntervalSince1970 * 1000
        let storagePath = fileUtil.fullPathInStorageForFilePath(filePath, inFolder: folderName)
        self.remoteFileUtil.downloadFile(from: resourceURL.absoluteString, andSaveFileAtUrl: storagePath, checksum: checksum) { [weak self] (status, _, errorString, _) in
            guard let self = self else { return }
            if status {
                let logVal = NSMutableDictionary()
                logVal["url"] = resourceURL.absoluteString
                logVal["timeTaken"] = (Date().timeIntervalSince1970 * 1000) - startTime
                self.tracker.trackInfo("file_download", value: logVal)
                completionHandler(nil)
            } else {
                var err = errorString
                if err == nil || err?.isEmpty == true {
                    err = "Couldn't download file"
                }
                let logData = NSMutableDictionary()
                logData["url"] = resourceURL.absoluteString
                logData["error"] = err
                self.tracker.trackError("fetch_failed", value: logData)
                completionHandler(NSError(domain: "in.juspay.Airborne", code: 1, userInfo: [NSLocalizedDescriptionKey: err ?? ""]))
            }
        }
    }
}

//
//  AJPApplicationManager.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation
import UIKit
#if SWIFT_PACKAGE
import AirborneSwiftCore
import AirborneSwiftModel
import AirborneObjC
#endif

// MARK: - Handlers & Wrappers

public typealias PackagesCompletionHandler = (AJPDownloadResult) -> Void
public typealias AJPReleaseConfigCompletionHandler = (AJPApplicationManifest?, Error?, Bool) -> Void

@objcMembers public class AJPDownloadResult: NSObject {
    public let releaseConfig: AJPApplicationManifest
    public let result: String
    public let errorString: String?
    
    @objc(initWithManifest:result:error:)
    public init(manifest: AJPApplicationManifest, result: String, error: String?) {
        self.releaseConfig = manifest
        self.result = result
        self.errorString = error
        super.init()
    }
    
    // Maintain property name parity for ObjC callers
    @objc public var error: String? { errorString }
}

/// The core manager orchestrating OTA downloads and lifecycle operations.
@objc(AJPApplicationManager)
@objcMembers public class AJPApplicationManager: NSObject {
    
    // MARK: - Static Multi-Workspace Map
    
    // Mimics the static NSMutableDictionary `managers` combined with `@synchronized([AJPApplicationManager class])`
    private static let classLock = NSLock()
    private static var managers: [String: AJPApplicationManager] = [:]
    
    private static var isFirstRunAfterInstallation = true
    private static var isFirstRunAfterAppLaunch = true
    
    // MARK: - Internal Locking
    
    private let stateLock = NSLock()
    private let collectionsLock = NSLock()
    
    // MARK: - Thread-Safe State Properties
    
    private var _bootTimeoutOccurred = false
    private var _releaseConfigTimeoutOccurred = false
    
    private var _importantPackageDownloadStatus: AJPDownloadStatus = .downloading
    private var _lazyPackageDownloadStatus: AJPDownloadStatus = .downloading
    private var _resourceDownloadStatus: AJPDownloadStatus = .downloading
    private var _releaseConfigDownloadStatus: AJPDownloadStatus = .downloading
    
    public var bootTimeoutOccurred: Bool {
        get { stateLock.withLock { _bootTimeoutOccurred } }
        set { stateLock.withLock { _bootTimeoutOccurred = newValue } }
    }
    
    public var releaseConfigTimeoutOccurred: Bool {
        get { stateLock.withLock { _releaseConfigTimeoutOccurred } }
        set { stateLock.withLock { _releaseConfigTimeoutOccurred = newValue } }
    }
    
    public var importantPackageDownloadStatus: AJPDownloadStatus {
        get { stateLock.withLock { _importantPackageDownloadStatus } }
        set { stateLock.withLock { _importantPackageDownloadStatus = newValue } }
    }
    
    public var lazyPackageDownloadStatus: AJPDownloadStatus {
        get { stateLock.withLock { _lazyPackageDownloadStatus } }
        set { stateLock.withLock { _lazyPackageDownloadStatus = newValue } }
    }
    
    public var resourceDownloadStatus: AJPDownloadStatus {
        get { stateLock.withLock { _resourceDownloadStatus } }
        set { stateLock.withLock { _resourceDownloadStatus = newValue } }
    }
    
    public var releaseConfigDownloadStatus: AJPDownloadStatus {
        get { stateLock.withLock { _releaseConfigDownloadStatus } }
        set { stateLock.withLock { _releaseConfigDownloadStatus = newValue } }
    }
    
    // MARK: - Thread-Safe Collection Properties
    
    private var _downloadedApplicationManifest: AJPApplicationManifest?
    private var _availableLazySplits: NSMutableDictionary = [:]
    private var _availableResources: NSMutableDictionary = [:]
    private var _downloadedSplits: NSMutableSet = []
    
    public var downloadedApplicationManifest: AJPApplicationManifest? {
        get { collectionsLock.withLock { _downloadedApplicationManifest } }
        set { collectionsLock.withLock { _downloadedApplicationManifest = newValue } }
    }
    
    // MARK: - Properties
    
    private var callbacksFired = false
    private var packageResourceObserver: NSObjectProtocol?
    private var packagesCompletionHandler: PackagesCompletionHandler?
    
    private var managerId: String
    private var startTime: TimeInterval
    private var workspace: String
    private var releaseConfigURL: String
    private var releaseConfigHeaders: [String: String]
    private var baseBundle: Bundle
    private var isLocalAssets: Bool
    private var forceUpdate: Bool
    
    private weak var delegate: AJPApplicationManagerDelegate?
    
    // Retain these ObjC types until swapped natively
    public var tracker: AJPApplicationTracker!
    public var fileUtil: AJPFileUtil!
    public var remoteFileUtil: AJPRemoteFileUtil!
    private var utils: AJPApplicationManagerUtils!
    
    // Active manifest parts
    public var currentLazy: [AJPLazyResource] = []
    public var downloadedLazy: [AJPLazyResource] = []
    public var resources: AJPApplicationResources!
    public var tempResources: AJPApplicationResources?
    public var config: AJPApplicationConfig!
    public var package: AJPApplicationPackage!
    
    public var releaseConfigError: String?
    public var packageError: String?
    
    // MARK: - NSLock Extension (Swift < 5.0 compatibility fallback if needed)
    // Implicitly provided via NSLock standard `lock`/`unlock` internally
    
    // MARK: - Initialization Engine
    
    @objc public class func getSharedInstance(withWorkspace workspace: String, delegate: AJPApplicationManagerDelegate, logger: Any?) -> AJPApplicationManager {
        classLock.lock()
        defer { classLock.unlock() }
        
        var manager = managers[workspace]
        
        if manager == nil || manager?.releaseConfigDownloadStatus == .failed || manager?.importantPackageDownloadStatus == .failed || manager?.importantPackageDownloadStatus == .completed {
            
            // Note: the obj-c signature allows logger to be id, but AJPApplicationTracker expects AJPLoggerDelegate
            manager = AJPApplicationManager(workspace: workspace, delegate: delegate, logger: logger as? AJPLoggerDelegate)
            managers[workspace] = manager
        } else {
            manager?.tracker.addLogger(logger as? AJPLoggerDelegate)
        }
        
        return manager!
    }
    
    private init(workspace: String, delegate: AJPApplicationManagerDelegate?, logger: AJPLoggerDelegate?) {
        self.workspace = workspace
        self.delegate = delegate
        
        self.releaseConfigURL = delegate?.getReleaseConfigURL() ?? ""
        
        // Map optionals properly
        if let headers = delegate?.getReleaseConfigHeaders?() as? [String: String] {
            self.releaseConfigHeaders = headers
        } else {
            self.releaseConfigHeaders = [:]
        }
        
        if let bundle = delegate?.getBaseBundle?() {
            self.baseBundle = bundle
        } else {
            self.baseBundle = Bundle.main
        }
        
        self.isLocalAssets = delegate?.shouldUseLocalAssets?() ?? false
        self.forceUpdate = delegate?.shouldDoForceUpdate?() ?? true
        
        self.startTime = Date().timeIntervalSince1970 * 1000
        self.managerId = UUID().uuidString.lowercased()
        
        self.tracker = AJPApplicationTracker(managerId: self.managerId, workspace: workspace)
        self.tracker.addLogger(logger)
        
        super.init()
        
        // Let's fire up initialization
        self.initializeDefaults()
        
        if self.isLocalAssets {
            self.releaseConfigDownloadStatus = .completed
            self.resourceDownloadStatus = .completed
            self.importantPackageDownloadStatus = .completed
            self.lazyPackageDownloadStatus = .completed
            self.cleanUpUnwantedFiles()
            
            NotificationCenter.default.post(name: AJPApplicationConstants.RELEASE_CONFIG_NOTIFICATION, object: nil, userInfo: [:])
        } else {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.startDownload()
            }
        }
    }
    
    deinit {
        if let observer = packageResourceObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Placeholder Methods for Next Phase translation

    private func initializeDefaults() {
        if let util = delegate?.getFileUtil?() as? AJPFileUtil {
            self.fileUtil = util
        } else {
            self.fileUtil = AJPFileUtil(workspace: self.workspace, baseBundle: self.baseBundle)
        }
        
        if let util = delegate?.getRemoteFileUtil?() as? AJPRemoteFileUtil {
            self.remoteFileUtil = util
        } else {
            let networkClient = AJPNetworkClient()
            networkClient.logger = self.tracker as AJPLoggerDelegate
            self.remoteFileUtil = AJPRemoteFileUtil(networkClient: networkClient)
        }
        
        self.utils = AJPApplicationManagerUtils(fileUtil: self.fileUtil, tracker: self.tracker, remoteFileUtil: self.remoteFileUtil)
        
        // Handle if any previously downloaded packages are available.
        self.handleTempPackageInstallation()
        
        self.package = self.readApplicationPackage()
        self.resources = self.readApplicationResources()
        
        // Handle if any previously downloaded resources are available.
        self.handleTempResourcesInstallation()
        
        self.config = self.readApplicationConfig()
        
        if self.package == nil || self.config == nil || self.resources == nil {
            if let data = try? self.fileUtil.getFileDataFromBundle("release_config.json") {
                if let manifest = try? AJPApplicationManifest(data: data as NSData) {
                    if self.config == nil { self.config = manifest.config }
                    if self.package == nil { self.package = manifest.package }
                    if self.resources == nil { self.resources = manifest.resources }
                }
            }
            
            if self.config == nil {
                self.config = AJPApplicationConfig()
                let logVal = NSMutableDictionary()
                logVal["error"] = "reason unknown"
                logVal["file_name"] = "config.json"
                self.tracker.trackError("release_config_read_failed", value: logVal)
            }
            
            if self.package == nil {
                self.package = AJPApplicationPackage()
                let logVal = NSMutableDictionary()
                logVal["error"] = "reason unknown"
                logVal["file_name"] = "package.json"
                self.tracker.trackError("release_config_read_failed", value: logVal)
            }
            
            if self.resources == nil {
                self.resources = AJPApplicationResources()
                let logVal = NSMutableDictionary()
                logVal["error"] = "reason unknown"
                logVal["file_name"] = "resources.json"
                self.tracker.trackError("release_config_read_failed", value: logVal)
            }
            
            let logVal = NSMutableDictionary()
            logVal["release_config"] = "Read bundled release_config.json"
            self.tracker.trackInfo("bundled_release_config", value: logVal)
        }
        
        self.initializeLazyResourcesDownloadStatus()
        
        collectionsLock.withLock {
            _availableLazySplits = utils.dictionaryFromResources(self.package.lazy)
            _availableResources = NSMutableDictionary(dictionary: self.resources.resources)
            _downloadedSplits = NSMutableSet()
            
            _downloadedSplits.add(self.package.index.filePath)
            for split in self.package.allImportantSplits() {
                _downloadedSplits.add(split.filePath)
            }
            for lazy in self.package.lazy where lazy.isDownloaded {
                _downloadedSplits.add(lazy.filePath)
            }
            
            let fm = FileManager.default
            for (key, _) in self.resources.resources {
                let fileName = utils.jsFileName(for: key)
                let filePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(fileName)
                let fullPath = self.fileUtil.fullPathInStorageForFilePath(filePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
                if fm.fileExists(atPath: fullPath) {
                    _downloadedSplits.add(key)
                }
            }
        }
        
        let initLog = NSMutableDictionary()
        initLog["package_version"] = self.package.version
        initLog["config_version"] = self.config.version
        self.tracker.trackInfo("init_with_local_config_versions", value: initLog)
    }
    
    // MARK: - Temp Restorations

    private func handleTempPackageInstallation() {
        let tempPackagePath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        guard FileManager.default.fileExists(atPath: tempPackagePath) else {
            return
        }
        do {
            guard let tempPackage = try fileUtil.getDecodedInstanceForClass(AJPApplicationPackage.self, withContentOfFileName: AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationPackage else {
                return
            }
            
            let tempFiles = utils.getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_PACKAGE_DIR, subFolder: AJPApplicationConstants.JUSPAY_TEMP_DIR, includeSubfolders: true)
            var allMoveSuccessful = true
            
            let infoMap = NSMutableDictionary()
            infoMap["count"] = tempFiles.count
            tracker.trackInfo("temp_package_installation_started", value: infoMap)
            var error: NSError? = nil
            for fileName in tempFiles {
                let success = movePackageFromTempToMain(fileName, error: &error)
                if !success {
                    allMoveSuccessful = false
                    let errMap = NSMutableDictionary()
                    errMap["file"] = fileName
                    errMap["error"] = error?.localizedDescription ?? "Unknown error"
                    tracker.trackError("file_move_failed", value: errMap)
                }
            }
            
            if allMoveSuccessful {
                do {
                    try fileUtil.writeInstance(tempPackage, fileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
                    let sMap = NSMutableDictionary()
                    sMap["version"] = tempPackage.version
                    tracker.trackInfo("temp_package_installed", value: sMap)
                } catch {
                    let fMap = NSMutableDictionary()
                    fMap["error"] = error.localizedDescription
                    tracker.trackError("temp_package_write_failed", value: fMap)
                }
            }
            
            try? fileUtil.deleteFile(AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
            utils.cleanupTempDirectory()
        } catch {
            let logVal = NSMutableDictionary()
            logVal["error"] = error.localizedDescription
            tracker.trackError("temp_package_read_failed", value: logVal)
            try? fileUtil.deleteFile(AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        }
    }
    
    private func handleTempResourcesInstallation() {
        let tempResourcesPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_TEMP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        guard FileManager.default.fileExists(atPath: tempResourcesPath) else {
            return
        }
        
        do {
            guard let tempResources = try fileUtil.getDecodedInstanceForClass(AJPApplicationResources.self, withContentOfFileName: AJPApplicationConstants.APP_TEMP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationResources else {
                return
            }
            
            let sMap = NSMutableDictionary()
            sMap["count"] = tempResources.resources.count
            tracker.trackInfo("temp_resources_installation_started", value: sMap)
            
            var updatedAvailableResources = self.resources.resources
            
            for (_, resource) in tempResources.resources {
                self.moveResourceToMain(resource)
                updatedAvailableResources[resource.filePath] = resource
            }
            
            self.resources.resources = updatedAvailableResources
            self.updateResources(updatedAvailableResources)
            
            let cMap = NSMutableDictionary()
            cMap["count"] = tempResources.resources.count
            tracker.trackInfo("temp_resources_installed", value: cMap)
            
            try? fileUtil.deleteFile(AJPApplicationConstants.APP_TEMP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        } catch {
            let map = NSMutableDictionary()
            map["error"] = error.localizedDescription
            tracker.trackError("temp_resources_read_failed", value: map)
            try? fileUtil.deleteFile(AJPApplicationConstants.APP_TEMP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        }
    }
    
    private func initializeLazyResourcesDownloadStatus() {
        let storedPackagePath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        AJPApplicationManager.isFirstRunAfterInstallation = !FileManager.default.fileExists(atPath: storedPackagePath)
        
        if self.package.lazy.count > 0, !FileManager.default.fileExists(atPath: storedPackagePath) {
            let updatedLazy = self.package.lazy
            for resource in updatedLazy {
                resource.isDownloaded = true
            }
            self.package.lazy = updatedLazy
            
            do {
                try self.fileUtil.writeInstance(self.package, fileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
                let map = NSMutableDictionary()
                map["count"] = updatedLazy.count
                tracker.trackInfo("lazy_resources_initialized", value: map)
            } catch {
                let errMap = NSMutableDictionary()
                errMap["error"] = error.localizedDescription
                tracker.trackError("lazy_resources_initialization_failed", value: errMap)
            }
        }
    }
    
    // MARK: - Exposed Public Getters
    
    @objc public func getCurrentApplicationManifest() -> Any? {
        stateLock.withLock {
            return AJPApplicationManifest(package: self.package, config: self.config, resources: self.resources)
        }
    }
    
    @objc public func getCurrentResult() -> AJPDownloadResult {
        let manifest = AJPApplicationManifest(package: self.package, config: self.config, resources: self.resources)
        
        let releaseConfigStatus = self.releaseConfigDownloadStatus
        let packageStatus = self.importantPackageDownloadStatus
        
        if releaseConfigStatus == .timeout {
            return AJPDownloadResult(manifest: manifest, result: "RELEASE_CONFIG_TIMEDOUT", error: nil)
        } else if releaseConfigStatus == .failed {
            return AJPDownloadResult(manifest: manifest, result: "ERROR", error: utils.sanitizedError(self.releaseConfigError))
        } else if packageStatus == .failed {
            return AJPDownloadResult(manifest: manifest, result: "PACKAGE_DOWNLOAD_FAILED", error: utils.sanitizedError(self.packageError))
        } else if packageStatus == .downloading {
            return AJPDownloadResult(manifest: manifest, result: "PACKAGE_TIMEDOUT", error: nil)
        }
        
        return AJPDownloadResult(manifest: manifest, result: "OK", error: nil)
    }
    
    @objc(waitForPackagesAndResourcesWithCompletion:)
    public func waitForPackagesAndResources(completion: @escaping PackagesCompletionHandler) {
        self.packagesCompletionHandler = completion
        
        if isPackageAndResourceDownloadCompleted() && isReleaseConfigDownloadCompleted() {
            completion(getCurrentResult())
            return
        }
        
        let center = NotificationCenter.default
        if let observer = self.packageResourceObserver {
            center.removeObserver(observer)
            self.packageResourceObserver = nil
        }
        
        self.packageResourceObserver = center.addObserver(forName: AJPApplicationConstants.PACKAGE_RESOURCE_NOTIFICATION, object: nil, queue: OperationQueue()) { [weak self] note in
            self?.handlePackageResourceCompletion()
        }
    }
    
    private func handlePackageResourceCompletion() {
        var handler: PackagesCompletionHandler?
        objc_sync_enter(self)
        if let h = packagesCompletionHandler {
            handler = h
            packagesCompletionHandler = nil
            if let observer = packageResourceObserver {
                NotificationCenter.default.removeObserver(observer)
                packageResourceObserver = nil
            }
        }
        objc_sync_exit(self)
        handler?(getCurrentResult())
    }
    
    @objc public func readPackageFile(_ fileName: String) -> String? {
        let filePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(fileName)
        do {
            let fileContent = try fileUtil.loadFile(filePath, folder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR, withLocalAssets: self.isLocalAssets)
            return fileContent
        } catch {
            let map = NSMutableDictionary()
            map["fileName"] = fileName.isEmpty ? "nil" : fileName
            map["error"] = error.localizedDescription
            tracker.trackError("read_package_file", value: map)
            return nil
        }
    }
    
    @objc public func readResourceFile(_ resourceFileName: String) -> String? {
        let mainResourcePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(resourceFileName)
        do {
            let fileContent = try fileUtil.loadFile(mainResourcePath, folder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR, withLocalAssets: self.isLocalAssets)
            return fileContent
        } catch {
            let map = NSMutableDictionary()
            map["resourceFileName"] = resourceFileName.isEmpty ? "nil" : resourceFileName
            map["error"] = error.localizedDescription
            tracker.trackError("read_resource_file", value: map)
            return nil
        }
    }
    
    @objc public func getReleaseConfigTimeout() -> NSNumber {
        return self.config.releaseConfigTimeout ?? NSNumber(value: 1000)
    }
    
    @objc public func getPackageTimeout() -> NSNumber {
        if let downloadedManifest = self.downloadedApplicationManifest {
            return downloadedManifest.config.bootTimeout
        }
        return self.config.bootTimeout
    }
    
    @objc public func isReleaseConfigDownloadCompleted() -> Bool {
        return utils.isDownloadCompleted(self.releaseConfigDownloadStatus)
    }
    
    @objc public func isPackageAndResourceDownloadCompleted() -> Bool {
        return utils.isDownloadCompleted(self.importantPackageDownloadStatus) &&
               utils.isDownloadCompleted(self.resourceDownloadStatus)
    }
    
    @objc public func isImportantPackageDownloadCompleted() -> Bool {
        return utils.isDownloadCompleted(self.importantPackageDownloadStatus)
    }
    
    @objc public func isLazyPackageDownloadCompleted() -> Bool {
        return utils.isDownloadCompleted(self.lazyPackageDownloadStatus)
    }
    
    @objc public func isResourcesDownloadCompleted() -> Bool {
        return utils.isDownloadCompleted(self.resourceDownloadStatus)
    }
    
    @objc public func getPathForPackageFile(_ fileName: String) -> String {
        let filePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(fileName)
        return fileUtil.fullPathInStorageForFilePath(filePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
    }
    
    @objc public func getPathForAssetsInReleaseConfig(_ resourcePath: String?) -> String? {
        guard let path = resourcePath, !path.isEmpty else { return nil }
        
        var isAvailable = false
        collectionsLock.withLock {
            isAvailable = _downloadedSplits.contains(path)
        }
        
        if !isAvailable { return nil }
        
        let resolvedFileName = utils.jsFileName(for: path)
        return getPathForPackageFile(resolvedFileName)
    }
    
    @objc public func getDownloadedSplits() -> Set<String> {
        var copy: Set<String> = []
        collectionsLock.withLock {
            if let arr = _downloadedSplits.allObjects as? [String] {
                copy = Set(arr)
            }
        }
        return copy
    }
    
    // MARK: - Reads
    
    private func readApplicationPackage() -> AJPApplicationPackage? {
        return try? fileUtil.getDecodedInstanceForClass(AJPApplicationPackage.self, withContentOfFileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationPackage
    }
    
    private func readApplicationResources() -> AJPApplicationResources? {
        return try? fileUtil.getDecodedInstanceForClass(AJPApplicationResources.self, withContentOfFileName: AJPApplicationConstants.APP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationResources
    }
    
    private func readApplicationConfig() -> AJPApplicationConfig? {
        return try? fileUtil.getDecodedInstanceForClass(AJPApplicationConfig.self, withContentOfFileName: AJPApplicationConstants.APP_CONFIG_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationConfig
    }
    
    // Dependencies to build for remaining missing helpers
    private func movePackageFromTempToMain(_ fileName: String, error: inout NSError?) -> Bool {
        let tempFilePath = (AJPApplicationConstants.JUSPAY_TEMP_DIR as NSString).appendingPathComponent(fileName)
        let mainFilePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(fileName)
        
        let tempPath = fileUtil.fullPathInStorageForFilePath(tempFilePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        let mainPath = fileUtil.fullPathInStorageForFilePath(mainFilePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: mainPath) {
            do {
                try fileManager.removeItem(atPath: mainPath)
            } catch let removeErr as NSError {
                error = removeErr
                return false
            }
        }
        
        do {
            try fileManager.moveItem(atPath: tempPath, toPath: mainPath)
            return true
        } catch let moveErr as NSError {
            error = moveErr
            return false
        }
    }
    
    private func moveResourceToMain(_ resource: AJPResource) {
        let fileManager = FileManager.default
        let fileNameOnDisk = utils.jsFileName(for: resource.filePath)
        
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
    
    private func updatePackage(_ package: AJPApplicationPackage, didDownloadImportant: Bool, startTime: TimeInterval) {
        let logVal = NSMutableDictionary()
        logVal["trying_to_install_package"] = "New app version downloaded, installing to disk. \(package.version)"
        tracker.trackInfo("app_update_result", value: logVal)
        
        if !didDownloadImportant || self.isAppInstalled(withPackage: package, inSubFolder: AJPApplicationConstants.JUSPAY_MAIN_DIR) {
            do {
                try fileUtil.writeInstance(package, fileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
                stateLock.withLock {
                    self.package = package
                }
                
                let resultLog = NSMutableDictionary()
                resultLog["package_version"] = package.version
                resultLog["result"] = "SUCCESS"
                resultLog["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                resultLog["resource_download_status"] = utils.getStatusString(self.resourceDownloadStatus)
                tracker.trackInfo("package_update_result", value: resultLog)
                
            } catch {
                let errLog = NSMutableDictionary()
                errLog["error"] = error.localizedDescription
                errLog["result"] = "FAILED"
                errLog["file_name"] = AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME
                errLog["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                tracker.trackInfo("package_update_result", value: errLog)
            }
        } else {
            let failLog = NSMutableDictionary()
            failLog["result"] = "FAILED"
            failLog["reason"] = "package copy failed"
            failLog["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
            tracker.trackInfo("package_update_result", value: failLog)
        }
    }
    
    private func updateAvailableResource(_ filePath: String, withResource resource: AJPResource) {
        collectionsLock.withLock {
            self._availableResources.setValue(resource, forKey: filePath)
        }
    }
    
    private func updateResources(_ dict: [String: AJPResource]) {
        let appResources = AJPApplicationResources()
        appResources.resources = dict
        do {
            try fileUtil.writeInstance(appResources, fileName: AJPApplicationConstants.APP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
            collectionsLock.withLock {
                self.resources = appResources
            }
        } catch {
            let map = NSMutableDictionary()
            map["error"] = error.localizedDescription
            map["file_name"] = "resources.json"
            tracker.trackError("release_config_write_failed", value: map)
        }
    }
    
    // MARK: - Config
    
    private func updateConfig(_ config: AJPApplicationConfig) {
        if config.version != self.config.version {
            do {
                try fileUtil.writeInstance(config, fileName: AJPApplicationConstants.APP_CONFIG_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
                stateLock.withLock {
                    self.config = config
                }
                let logData = NSMutableDictionary()
                logData["new_config_version"] = config.version
                tracker.trackInfo("config_updated", value: logData)
            } catch {
                let logVal = NSMutableDictionary()
                logVal["error"] = error.localizedDescription
                tracker.trackError("release_config_write_failed", value: logVal)
            }
        }
    }
    
    // MARK: - Handlers & Sub-Loops
    
    private func getReleaseConfigTimeout() -> NSNumber? {
        return self.config.releaseConfigTimeout
    }
    
    private func startBootTimeoutTimer() {
        let bootTimeout = self.getPackageTimeout().intValue
        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + .milliseconds(bootTimeout)) { [weak self] in
            guard let self = self else { return }
            self.bootTimeoutOccurred = true
            NotificationCenter.default.post(name: AJPApplicationConstants.BOOT_TIMEOUT_NOTIFICATION, object: nil, userInfo: [:])
            self.handlePackageResourceCompletion()
        }
    }
    
    private func startReleaseConfigTimeoutTimer() {
        guard let releaseConfigTimeout = self.getReleaseConfigTimeout()?.intValue else { return }
        
        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + .milliseconds(releaseConfigTimeout)) { [weak self] in
            guard let self = self else { return }
            self.releaseConfigTimeoutOccurred = true
            
            let map = NSMutableDictionary()
            map["timeout"] = NSNumber(value: releaseConfigTimeout)
            self.tracker.trackInfo("release_config_timeout", value: map)
            
            NotificationCenter.default.post(name: AJPApplicationConstants.RELEASE_CONFIG_TIMEOUT_NOTIFICATION, object: nil, userInfo: [:])
        }
    }
    
    private func getResourcesFrom(_ newSplits: [AJPResource], filtering currentSplits: [AJPResource]) -> [AJPResource] {
        if AJPApplicationManager.isFirstRunAfterInstallation {
            return newSplits
        }
        
        var toDownload: [AJPResource] = []
        var toDownloadMap: [String: AJPResource] = [:]
        
        for split in newSplits {
            toDownloadMap[split.filePath] = split
        }
        
        for split in currentSplits {
            if let newSplit = toDownloadMap[split.filePath] {
                if !self.shouldDownloadResource(newSplit, existingResource: split) {
                    toDownloadMap.removeValue(forKey: split.filePath)
                }
            }
        }
        
        toDownload = Array(toDownloadMap.values)
        return toDownload
    }
    
    private func shouldDownloadResource(_ resourceToBeDownloaded: AJPResource?, existingResource: AJPResource?) -> Bool {
        guard let existingResource = existingResource else { return true }
        guard let resourceToBeDownloaded = resourceToBeDownloaded else { return false }
        
        let urlChanged = resourceToBeDownloaded.url.absoluteString != existingResource.url.absoluteString
        if urlChanged { return true }
        
        if let newChecksum = resourceToBeDownloaded.checksum, !newChecksum.isEmpty,
           let existingChecksum = existingResource.checksum, !existingChecksum.isEmpty {
            return newChecksum != existingChecksum
        }
        
        // If either is nil or empty, treat them as different
        return true
    }
    
    // MARK: - Temp Manifest
    
    private func saveManifestToTemp(_ manifest: AJPApplicationManifest) {
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
    
    private func readTempManifest() -> AJPApplicationManifest? {
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
    
    private func deleteTempManifest() {
        let tempManifestPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_MANIFEST_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        guard FileManager.default.fileExists(atPath: tempManifestPath) else { return }
        try? utils.deleteFile(AJPApplicationConstants.APP_MANIFEST_DATA_TEMP_FILE_NAME, subFolder: "", inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
    }
    
    private func cleanUpUnwantedFiles() {
        if AJPApplicationManager.isFirstRunAfterAppLaunch {
            AJPApplicationManager.isFirstRunAfterAppLaunch = false
            
            let allPackageFiles = utils.getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_PACKAGE_DIR, subFolder: AJPApplicationConstants.JUSPAY_MAIN_DIR, includeSubfolders: true)
            var requiredFiles = Set<String>()
            
            for resource in self.package.allSplits() {
                requiredFiles.insert(utils.jsFileName(for: resource.filePath))
            }
            
            if let downloadedManifest = self.downloadedApplicationManifest {
                let dlPackage = downloadedManifest.package
                for resource in dlPackage.allSplits() {
                    requiredFiles.insert(utils.jsFileName(for: resource.filePath))
                }
            }
            
            let resourcesData = self.resources.resources
            for (_, resource) in resourcesData {
                requiredFiles.insert(utils.jsFileName(for: resource.filePath))
            }
            
            for fileName in allPackageFiles {
                let shouldKeep = requiredFiles.contains(fileName)
                if !shouldKeep {
                    let map = NSMutableDictionary()
                    map["file"] = fileName
                    tracker.trackInfo("cleaning_unused_file", value: map)
                    try? utils.deleteFile(fileName, subFolder: AJPApplicationConstants.JUSPAY_MAIN_DIR, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
                }
            }
            
            let resourceFileNames = utils.getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_RESOURCE_DIR, subFolder: "", includeSubfolders: true)
            for fileName in resourceFileNames {
                try? utils.deleteFile(fileName, subFolder: "", inFolder: AJPApplicationConstants.JUSPAY_RESOURCE_DIR)
            }
        }
    }
    
    private func startDownload() {
        self.releaseConfigDownloadStatus = .downloading
        self.importantPackageDownloadStatus = .downloading
        self.lazyPackageDownloadStatus = .downloading
        self.resourceDownloadStatus = .downloading
        
        self.fetchReleaseConfigWithCompletionHandler { [weak self] manifest, error, didTimeout in
            guard let self = self else { return }
            
            if !didTimeout && error == nil && manifest != nil {
                self.downloadedApplicationManifest = manifest
                self.releaseConfigDownloadStatus = .completed
                self.cleanUpUnwantedFiles()
                if let config = manifest?.config {
                    self.updateConfig(config)
                }
                self.tryDownloadingUpdate()
            } else {
                self.releaseConfigDownloadStatus = didTimeout ? .timeout : .failed
                if let error = error {
                    self.releaseConfigError = self.utils.sanitizedError(error.localizedDescription)
                } else {
                    self.releaseConfigError = nil
                }
                
                if let manifest = manifest {
                    self.downloadedApplicationManifest = manifest
                    self.cleanUpUnwantedFiles()
                    self.updateConfig(manifest.config)
                    self.tryDownloadingUpdate()
                } else {
                    self.resourceDownloadStatus = .completed
                    self.importantPackageDownloadStatus = .completed
                    self.lazyPackageDownloadStatus = .completed
                    self.cleanUpUnwantedFiles()
                    self.fireCallbacks()
                    self.retryFailedLazyDownloads()
                }
            }
            
            NotificationCenter.default.post(name: AJPApplicationConstants.RELEASE_CONFIG_NOTIFICATION, object: nil, userInfo: [:])
        }
    }
    
    private func tryDownloadingUpdate() {
        guard let downloadedManifest = self.downloadedApplicationManifest else { return }
        
        if !(self.package.version == downloadedManifest.package.version && self.package.name == downloadedManifest.package.name) {
            self.startBootTimeoutTimer()
            
            let currentLazy = self.package.lazy
            self.downloadedLazy = downloadedManifest.package.lazy
            
            self.downloadImportantPackagesWithNewManifest(downloadedManifest.package, currentManifest: self.package) { [weak self] downloadFailed, timedOut in
                guard let self = self else { return }
                
                if !downloadFailed {
                    self.didFinishImportantPackageWithLazyDownloadComplete(timedOut)
                    
                    if timedOut {
                        self.retryFailedLazyDownloadsWithCompletion { [weak self] in
                            guard let self = self else { return }
                            let toDownload = self.getResourcesFrom(self.downloadedLazy.compactMap { $0 }, filtering: currentLazy)
                            let packageVersion = self.downloadedApplicationManifest?.package.version ?? ""
                            
                            self.downloadLazyPackageResources(toDownload, version: packageVersion, singleDownloadHandler: { [weak self] status, resource in
                                guard let self = self, status, let _ = resource as? AJPLazyResource else { return }
                                
                                self.collectionsLock.withLock {
                                    for i in 0..<self.downloadedLazy.count {
                                        let existing = self.downloadedLazy[i]
                                        if existing.filePath == resource.filePath {
                                            self.downloadedLazy[i].isDownloaded = status
                                            break
                                        }
                                    }
                                }
                            }, downloadCompletion: { [weak self] in
                                guard let self = self else { return }
                                self.downloadedApplicationManifest?.package.lazy = self.downloadedLazy.compactMap { $0 }
                                if let pkg = self.downloadedApplicationManifest?.package {
                                    self.updatePackageInTemp(pkg)
                                }
                            })
                        }
                    } else {
                        let toDownload = self.getResourcesFrom(self.downloadedLazy.compactMap { $0 }, filtering: currentLazy)
                        let pendingLazyPaths = Set(toDownload.map { $0.filePath })
                        
                        self.collectionsLock.withLock {
                            var validPaths = Set<String>()
                            validPaths.insert(self.package.index.filePath)
                            
                            for split in self.package.allImportantSplits() {
                                validPaths.insert(split.filePath)
                            }
                            
                            for lazy in self.downloadedLazy.compactMap({ $0 }) {
                                if !pendingLazyPaths.contains(lazy.filePath) && lazy.isDownloaded {
                                    validPaths.insert(lazy.filePath)
                                }
                            }
                            
                            for resourcePath in self._availableResources.allKeys {
                                if let path = resourcePath as? String {
                                    validPaths.insert(path)
                                }
                            }
                            
                            let currentSplits = Array(self._downloadedSplits)
                            for path in currentSplits {
                                if let p = path as? String, !validPaths.contains(p) {
                                    self._downloadedSplits.remove(p)
                                }
                            }
                            
                            for p in validPaths {
                                self._downloadedSplits.add(p)
                            }
                        }
                        
                        let packageVersion = self.package.version
                        self.downloadLazyPackageResources(toDownload, version: packageVersion, singleDownloadHandler: { [weak self] status, resource in
                            guard let self = self else { return }
                            if status, let lazyResource = resource as? AJPLazyResource {
                                self.moveLazyPackageFromTempToMain(lazyResource)
                            }
                            NotificationCenter.default.post(name: AJPApplicationConstants.LAZY_PACKAGE_NOTIFICATION, object: nil, userInfo: [
                                "lazyDownloadsComplete": false,
                                "downloadStatus": status,
                                "url": resource.url,
                                "filePath": resource.filePath
                            ])
                        }, downloadCompletion: { [weak self] in
                            guard self != nil else { return }
                            NotificationCenter.default.post(name: AJPApplicationConstants.LAZY_PACKAGE_NOTIFICATION, object: nil, userInfo: ["lazyDownloadsComplete": true])
                        })
                    }
                } else {
                    self.didFinishImportantPackageWithLazyDownloadComplete(true)
                    self.retryFailedLazyDownloads()
                }
            }
        } else {
            tracker.trackInfo("package_update_info", value: NSMutableDictionary(dictionary: ["package_splits_download": "No updates in app"]))
            self.didFinishImportantPackageWithLazyDownloadComplete(true)
            self.retryFailedLazyDownloads()
        }

        self.downloadResourcesWithCurrentResources(
            self.resources.resources,
            newResources: downloadedManifest.resources.resources,
            singleDownloadHandler: { [weak self] key, _ in
                self?.tracker.trackInfo("resource_download_completed", value: NSMutableDictionary(dictionary: ["resource": key]))
            },
            downloadCompletion: { [weak self] in
                guard let self = self else { return }
                self.resourceDownloadStatus = .completed
                self.fireCallbacks()
            }
        )
    }
    
    private func fetchReleaseConfigWithCompletionHandler(_ completionHandler: @escaping AJPReleaseConfigCompletionHandler) {
        
        var timeoutObserver: Any? = nil
        timeoutObserver = NotificationCenter.default.addObserver(forName: AJPApplicationConstants.RELEASE_CONFIG_TIMEOUT_NOTIFICATION, object: nil, queue: OperationQueue()) { [weak self] note in
            guard let self = self else { return }
            
            if let observer = timeoutObserver {
                NotificationCenter.default.removeObserver(observer)
            }
            
            let tempManifest = self.readTempManifest()
            let value = NSMutableDictionary()
            
            if let tempManifest = tempManifest {
                value["status"] = "true"
                value["config_version"] = tempManifest.config.version
                value["package_version"] = tempManifest.package.version
            } else {
                value["status"] = "false"
            }
            
            self.tracker.trackInfo("manifest_read_from_temp", value: value)
            completionHandler(tempManifest, nil, true)
        }
        
        self.startReleaseConfigTimeoutTimer()
        
        guard let manifestUrl = URL(string: self.releaseConfigURL) else {
            completionHandler(nil, NSError(domain: "in.juspay.Airborne", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"]), false)
            return
        }
        
        var request = URLRequest(url: manifestUrl)
        request.httpMethod = "GET"
        
        let networkType = AJPNetworkTypeDetector.currentNetworkTypeString()
        request.setValue(networkType, forHTTPHeaderField: "x-network-type")
        #if os(iOS)
        request.setValue(UIDevice.current.systemVersion, forHTTPHeaderField: "x-os-version")
        #endif
        request.setValue(self.package.version, forHTTPHeaderField: "x-package-version")
        request.setValue(self.config.version, forHTTPHeaderField: "x-config-version")
        
        var dimensions = ""
        if let headers = self.delegate?.getReleaseConfigHeaders?() {
            for (key, value) in headers {
                dimensions.append("\(key)=\(value);")
            }
        }
        
        if !dimensions.isEmpty {
            request.setValue(dimensions, forHTTPHeaderField: "x-dimension")
        }
        
        let startTime = Date().timeIntervalSince1970 * 1000
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let observer = timeoutObserver {
                NotificationCenter.default.removeObserver(observer)
            }
            
            let didTimeoutOccur = self.releaseConfigTimeoutOccurred
            
            let statusCode = self.utils.getResponseCode(from: response)
            let logData = NSMutableDictionary()
            logData["release_config_url"] = manifestUrl.absoluteString
            logData["status"] = NSNumber(value: statusCode)
            logData["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
            
            if let error = error {
                logData["error"] = error.localizedDescription
                logData["is_success"] = false
                self.tracker.trackInfo("release_config_fetch", value: logData)
                
                if !didTimeoutOccur {
                    completionHandler(nil, error, false)
                }
                return
            }
            
            if let data = data {
                var manifestError: NSError?
                var manifest: AJPApplicationManifest?
                
                do {
                    manifest = try AJPApplicationManifest(data: NSData(data: data))
                } catch let err as NSError {
                    manifestError = err
                }
                
                logData["is_success"] = manifest != nil
                if let err = manifestError {
                    logData["error"] = err.localizedDescription
                    logData["message"] = "Failed to parse release config"
                }
                if manifestError == nil, let manifest = manifest {
                    logData["new_rc_version"] = manifest.config.version
                }
                self.tracker.trackInfo("release_config_fetch", value: logData)
                
                if !didTimeoutOccur {
                    self.deleteTempManifest()
                    completionHandler(manifest, manifestError, false)
                } else {
                    if let manifest = manifest, manifestError == nil {
                        self.tracker.trackInfo("release_config_fetch_after_timeout", value: NSMutableDictionary(dictionary: ["version": manifest.config.version]))
                        self.saveManifestToTemp(manifest)
                    }
                }
            } else {
                logData["is_success"] = false
                logData["error"] = "no data found"
                self.tracker.trackInfo("release_config_fetch", value: logData)
                
                if !didTimeoutOccur {
                    completionHandler(nil, nil, false)
                }
            }
        }
        
        task.resume()
    }
    
    // MARK: - Downloads & Moving
    
    private func downloadImportantPackagesWithNewManifest(_ newManifest: AJPApplicationPackage, currentManifest: AJPApplicationPackage, onCompletion: @escaping (Bool, Bool) -> Void) {
        let startTime = Date().timeIntervalSince1970 * 1000
        let downloadLock = NSLock()
        var timeoutOccurred = false
        var allDownloadsComplete = false
        
        var timeoutObserver: Any? = nil
        timeoutObserver = NotificationCenter.default.addObserver(forName: AJPApplicationConstants.BOOT_TIMEOUT_NOTIFICATION, object: nil, queue: OperationQueue()) { [weak self] _ in
            guard let self = self else { return }
            downloadLock.withLock {
                if !allDownloadsComplete {
                    timeoutOccurred = true
                    let map = NSMutableDictionary()
                    map["result"] = "TIMEOUT"
                    map["boot_timeout"] = self.getPackageTimeout()
                    map["importantPackageDownloadCompleted"] = self.isDownloadCompleted(self.importantPackageDownloadStatus)
                    map["resourcesDownloadCompleted"] = self.isDownloadCompleted(self.resourceDownloadStatus)
                    map["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                    self.tracker.trackInfo("important_package_update_result", value: map)
                    
                    self.importantPackageDownloadStatus = .completed
                    self.resourceDownloadStatus = .completed
                }
            }
        }
        
        self.utils.prepareTempDirectory()
        
        let currentSplits = currentManifest.allImportantSplits()
        let newSplits = newManifest.allImportantSplits()
        let toDownload = utils.getResourcesFrom(newSplits, filtering: currentSplits, isFirstRunAfterInstallation: AJPApplicationManager.isFirstRunAfterInstallation)
        
        self.tracker.trackInfo("important_package_download_started", value: NSMutableDictionary(dictionary: ["package_version": newManifest.version]))
        let packageStartTime = Date().timeIntervalSince1970 * 1000
        
        if toDownload.isEmpty {
            self.tracker.trackInfo("package_update_info", value: NSMutableDictionary(dictionary: ["important_splits_download": "No new important splits available"]))
            self.updatePackage(newManifest, didDownloadImportant: false, startTime: packageStartTime)
            if let obs = timeoutObserver { NotificationCenter.default.removeObserver(obs) }
            onCompletion(false, false)
            return
        }
        
        var pendingDownloads = Set(toDownload.map { $0.filePath })
        var failedDownloads = Set<String>()
        
        let group = DispatchGroup()
        let globalQueue = DispatchQueue.global(qos: .userInitiated)
        
        for split in toDownload {
            group.enter()
            globalQueue.async { [weak self] in
                guard let self = self else {
                    group.leave()
                    return
                }
                
                let fileName = (split.url.pathExtension == "zip") ? split.url.lastPathComponent : split.filePath
                let tempPath = "\(AJPApplicationConstants.JUSPAY_TEMP_DIR)/\(fileName)"
                
                self.utils.downloadFileFromURL(split.url, andSaveInFilePath: tempPath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR, checksum: split.checksum) { [weak self] error in
                    guard let self = self else {
                        group.leave()
                        return
                    }
                    downloadLock.withLock {
                        pendingDownloads.remove(split.filePath)
                        if let error = error {
                            failedDownloads.insert(split.filePath)
                            let map = NSMutableDictionary()
                            map["file"] = split.filePath
                            map["error"] = error.localizedDescription
                            self.tracker.trackError("important_package_download_error", value: map)
                        }
                    }
                    group.leave()
                }
            }
        }
        
        group.notify(queue: globalQueue) { [weak self] in
            guard let self = self else { return }
            downloadLock.lock()
            allDownloadsComplete = true
            
            if !failedDownloads.isEmpty {
                self.importantPackageDownloadStatus = .failed
                self.packageError = "Failed to download packages: \(failedDownloads)"
                let map = NSMutableDictionary()
                map["result"] = "FAILED"
                map["reason"] = "important"
                map["error"] = self.packageError ?? ""
                map["timeout"] = timeoutOccurred
                self.tracker.trackError("important_package_download_result", value: map)
                
                self.utils.cleanupTempDirectory()
                onCompletion(true, timeoutOccurred)
                
            } else if timeoutOccurred || !self.forceUpdate {
                let map = NSMutableDictionary()
                map["timeoutOccurred"] = timeoutOccurred
                map["forceUpdate"] = self.forceUpdate
                map["failed_downloads"] = Array(failedDownloads)
                map["all_successful"] = failedDownloads.isEmpty
                map["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                self.tracker.trackInfo("downloads_completed_after_timeout", value: map)
                onCompletion(false, true)
                
            } else {
                let map = NSMutableDictionary()
                map["result"] = "SUCCESS"
                map["reason"] = "important"
                map["boot_timeout"] = self.getPackageTimeout()
                map["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                self.tracker.trackInfo("important_package_download_result", value: map)
                
                self.moveAllPackagesFromTempToMain()
                self.updatePackage(newManifest, didDownloadImportant: true, startTime: startTime)
                
                let map2 = NSMutableDictionary()
                map2["result"] = "SUCCESS"
                map2["boot_timeout"] = self.getPackageTimeout()
                map2["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                self.tracker.trackInfo("important_package_update_result", value: map2)
                
                onCompletion(false, false)
            }
            
            if let obs = timeoutObserver { NotificationCenter.default.removeObserver(obs) }
            downloadLock.unlock()
        }
    }
    
    private func moveAllPackagesFromTempToMain() {
        let tempDirPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.JUSPAY_TEMP_DIR, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        
        guard let tempFiles = try? FileManager.default.contentsOfDirectory(atPath: tempDirPath) else {
            let map = NSMutableDictionary()
            map["error"] = "Could not read temp directory"
            tracker.trackError("temp_directory_read_failed", value: map)
            return
        }
        
        for fileName in tempFiles {
            do {
                try self.movePackageFromTempToMain(fileName)
                let map = NSMutableDictionary()
                map["file"] = fileName
                tracker.trackInfo("file_moved_to_main", value: map)
            } catch {
                let map = NSMutableDictionary()
                map["file"] = fileName
                map["error"] = error.localizedDescription
                tracker.trackError("file_move_failed", value: map)
            }
        }
    }
    
    private func movePackageFromTempToMain(_ fileName: String) throws {
        let tempFilePath = "\(AJPApplicationConstants.JUSPAY_TEMP_DIR)/\(fileName)"
        let mainFilePath = "\(AJPApplicationConstants.JUSPAY_MAIN_DIR)/\(fileName)"
        
        let tempPath = fileUtil.fullPathInStorageForFilePath(tempFilePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        let mainPath = fileUtil.fullPathInStorageForFilePath(mainFilePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: mainPath) {
            try fileManager.removeItem(atPath: mainPath)
        }
        
        try fileManager.moveItem(atPath: tempPath, toPath: mainPath)
    }
    
    private func isAppInstalled(withPackage package: AJPApplicationPackage, inSubFolder subFolder: String) -> Bool {
        let downloadedFileNames = utils.getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_PACKAGE_DIR, subFolder: subFolder, includeSubfolders: true)
        
        for split in package.allImportantSplits() {
            let fileNameOnDisk = utils.jsFileName(for: split.filePath)
            if !downloadedFileNames.contains(fileNameOnDisk) {
                let map = NSMutableDictionary()
                map["file_missing"] = split.filePath
                tracker.trackInfo("package_install_failed", value: map)
                return false
            }
        }
        return true
    }
    
    private func isDownloadCompleted(_ status: AJPDownloadStatus) -> Bool {
        return status == .completed || status == .failed || status == .timeout
    }
    
    private func moveLazyPackageFromTempToMain(_ resource: AJPLazyResource) {
        let fileName = resource.filePath
        do {
            try movePackageFromTempToMain(fileName)
            self.updateAvailableResource(resource.filePath, withResource: resource)
            self.updateLazyPackageDownloadStatus(resource, withStatus: true)
            collectionsLock.withLock {
                self._downloadedSplits.add(resource.filePath)
            }
        } catch {
            let map = NSMutableDictionary()
            map["file"] = fileName
            map["error"] = error.localizedDescription
            tracker.trackError("lazy_package_move_failed", value: map)
        }
    }
    
    private func downloadLazyPackageResources(_ resourcesToDownload: [AJPResource], version: String, singleDownloadHandler: @escaping (Bool, AJPResource) -> Void, downloadCompletion: @escaping () -> Void) {
        let startTime = Date().timeIntervalSince1970 * 1000
        if resourcesToDownload.isEmpty {
            self.tracker.trackInfo("package_update_info", value: NSMutableDictionary(dictionary: ["lazy_splits_download": "No new lazy splits available"]))
            self.lazyPackageDownloadStatus = .completed
            downloadCompletion()
            return
        }
        
        self.tracker.trackInfo("lazy_package_download_started", value: NSMutableDictionary(dictionary: ["package_version": version]))
        let group = DispatchGroup()
        let globalQueue = DispatchQueue.global(qos: .default)
        
        for split in resourcesToDownload {
            group.enter()
            globalQueue.async { [weak self] in
                guard let self = self else {
                    singleDownloadHandler(false, split)
                    group.leave()
                    return
                }
                
                let tempFilePath = "\(AJPApplicationConstants.JUSPAY_TEMP_DIR)/\(split.filePath)"
                self.utils.downloadFileFromURL(split.url, andSaveInFilePath: tempFilePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR, checksum: split.checksum) { [weak self] error in
                    guard let self = self else {
                        singleDownloadHandler(error == nil, split)
                        group.leave()
                        return
                    }
                    
                    if let error = error {
                        let map = NSMutableDictionary()
                        map["url"] = split.url.absoluteString
                        map["error"] = error.localizedDescription
                        self.tracker.trackError("lazy_package_download_error", value: map)
                        
                        self.packageError = "Failed to download lazy package: \(error.localizedDescription)"
                        let map2 = NSMutableDictionary()
                        map2["result"] = "FAILED"
                        map2["reason"] = "lazy"
                        map2["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                        map2["error"] = self.packageError ?? ""
                        self.tracker.trackError("lazy_package_download_result", value: map2)
                    }
                    singleDownloadHandler(error == nil, split)
                    group.leave()
                }
            }
        }
        
        group.notify(queue: globalQueue) { [weak self] in
            guard let self = self else { return }
            self.lazyPackageDownloadStatus = .completed
            let map = NSMutableDictionary()
            map["result"] = "SUCCESS"
            map["reason"] = "lazy"
            map["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
            self.tracker.trackInfo("lazy_package_download_result", value: map)
            downloadCompletion()
        }
    }
    
    private func retryFailedLazyDownloads() {
        var failedDownloads = [AJPLazyResource]()
        stateLock.withLock {
            for resource in self.package.lazy {
                if !resource.isDownloaded {
                    failedDownloads.append(resource)
                }
            }
        }
        
        if !failedDownloads.isEmpty {
            self.tracker.trackInfo("retrying_failed_lazy_downloads", value: NSMutableDictionary(dictionary: ["count": failedDownloads.count]))
            self.downloadLazyPackageResources(failedDownloads, version: self.package.version, singleDownloadHandler: { [weak self] status, resource in
                guard let self = self else { return }
                if status, let lazy = resource as? AJPLazyResource {
                    self.moveLazyPackageFromTempToMain(lazy)
                }
                NotificationCenter.default.post(name: AJPApplicationConstants.LAZY_PACKAGE_NOTIFICATION, object: nil, userInfo: [
                    "lazyDownloadsComplete": false,
                    "downloadStatus": status,
                    "url": resource.url,
                    "filePath": resource.filePath
                ])
            }, downloadCompletion: {
                NotificationCenter.default.post(name: AJPApplicationConstants.LAZY_PACKAGE_NOTIFICATION, object: nil, userInfo: ["lazyDownloadsComplete": true])
            })
        } else {
            self.tracker.trackInfo("no_failed_lazy_downloads", value: NSMutableDictionary())
        }
    }
    
    private func retryFailedLazyDownloadsWithCompletion(_ completion: @escaping () -> Void) {
        var failedDownloads = [AJPLazyResource]()
        stateLock.withLock {
            for resource in self.package.lazy {
                if !resource.isDownloaded {
                    failedDownloads.append(resource)
                }
            }
        }
        
        if !failedDownloads.isEmpty {
            self.tracker.trackInfo("retrying_failed_lazy_downloads", value: NSMutableDictionary(dictionary: ["count": failedDownloads.count]))
            self.downloadLazyPackageResources(failedDownloads, version: self.package.version, singleDownloadHandler: { [weak self] status, resource in
                guard let self = self else { return }
                if status, let lazy = resource as? AJPLazyResource {
                    self.moveLazyPackageFromTempToMain(lazy)
                }
                NotificationCenter.default.post(name: AJPApplicationConstants.LAZY_PACKAGE_NOTIFICATION, object: nil, userInfo: [
                    "lazyDownloadsComplete": false,
                    "downloadStatus": status,
                    "url": resource.url,
                    "filePath": resource.filePath
                ])
            }, downloadCompletion: {
                NotificationCenter.default.post(name: AJPApplicationConstants.LAZY_PACKAGE_NOTIFICATION, object: nil, userInfo: ["lazyDownloadsComplete": true])
                completion()
            })
        } else {
            self.tracker.trackInfo("no_failed_lazy_downloads", value: NSMutableDictionary())
            completion()
        }
    }
    
    private func updatePackageInTemp(_ package: AJPApplicationPackage) {
        let map = NSMutableDictionary()
        map["trying_to_install_temp_package"] = "New app version downloaded in temp, installing to disk. \(package.version)"
        self.tracker.trackInfo("app_update_result", value: map)
        do {
            try fileUtil.writeInstance(package, fileName: AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        } catch {
            let errMap = NSMutableDictionary()
            errMap["error"] = error.localizedDescription
            errMap["result"] = "FAILED"
            errMap["file_name"] = AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME
            self.tracker.trackInfo("package_update_result", value: errMap)
        }
    }
    
    private func updateLazyPackageDownloadStatus(_ resource: AJPLazyResource, withStatus isDownloaded: Bool) {
        stateLock.withLock {
            let updatedLazy = self.package.lazy
            var found = false
            for i in 0..<updatedLazy.count {
                if updatedLazy[i].filePath == resource.filePath {
                    updatedLazy[i].isDownloaded = isDownloaded
                    found = true
                    break
                }
            }
            
            if found {
                self.package.lazy = updatedLazy
                do {
                    try fileUtil.writeInstance(self.package, fileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
                    let map = NSMutableDictionary()
                    map["filePath"] = resource.filePath
                    map["isDownloaded"] = isDownloaded
                    self.tracker.trackInfo("lazy_package_status_updated", value: map)
                } catch {
                    let map = NSMutableDictionary()
                    map["error"] = error.localizedDescription
                    map["file_path"] = resource.filePath
                    self.tracker.trackError("lazy_package_update_failed", value: map)
                }
            }
        }
    }
    
    private func didFinishImportantPackageWithLazyDownloadComplete(_ isLazyDownloadComplete: Bool) {
        if self.importantPackageDownloadStatus == .completed || self.importantPackageDownloadStatus == .failed {
            return
        }
        self.importantPackageDownloadStatus = .completed
        if isLazyDownloadComplete {
            self.lazyPackageDownloadStatus = .completed
        }
        self.fireCallbacks()
    }
    
    private func fireCallbacks() {
        stateLock.lock()
        
        let shouldFire = !callbacksFired
            && isDownloadCompleted(_importantPackageDownloadStatus)
            && isDownloadCompleted(_resourceDownloadStatus)
        
        if shouldFire {
            callbacksFired = true
        }
        
        stateLock.unlock()
        
        if shouldFire {
            let map = NSMutableDictionary()
            map["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - self.startTime)
            tracker.trackInfo("update_end", value: map)
            NotificationCenter.default.post(name: AJPApplicationConstants.PACKAGE_RESOURCE_NOTIFICATION, object: nil, userInfo: [:])
        }
    }
    
    private func downloadResourcesWithCurrentResources(_ currentResources: [String: AJPResource], newResources: [String: AJPResource], singleDownloadHandler: @escaping (String, AJPResource) -> Void, downloadCompletion: @escaping () -> Void) {

        handleResourceFilePreparationForDownload()

        let oldResources = loadOldResourcesForComparison()

        let resourcesToDownload = filterResourcesForDownloadUsingOld(oldResources, newResources: newResources)

        let logMap = NSMutableDictionary()
        logMap["old_resources_count"] = oldResources.count
        logMap["new_resources_count"] = newResources.count
        logMap["resources_to_download"] = resourcesToDownload.count
        tracker.trackInfo("resources_filtered_for_download", value: logMap)

        let pendingPaths = Set(resourcesToDownload.map { $0.filePath })
        collectionsLock.withLock {
            for key in newResources.keys where !pendingPaths.contains(key) {
                _downloadedSplits.add(key)
            }
        }

        if resourcesToDownload.isEmpty {
            downloadCompletion()
            return
        }

        let group = DispatchGroup()
        let globalQueue = DispatchQueue.global(qos: .default)

        for resource in resourcesToDownload {
            if self.bootTimeoutOccurred {
                let infoMap = NSMutableDictionary()
                infoMap["resource"] = resource.filePath
                tracker.trackInfo("resource_download_stopped_due_to_timeout", value: infoMap)
                break
            }

            group.enter()
            globalQueue.async { [weak self] in
                guard let self = self, !self.bootTimeoutOccurred else {
                    group.leave()
                    return
                }

                self.utils.downloadFileFromURL(resource.url, andSaveInFilePath: resource.filePath, inFolder: AJPApplicationConstants.JUSPAY_RESOURCE_DIR, checksum: resource.checksum) { [weak self] error in
                    guard let self = self else {
                        group.leave()
                        return
                    }

                    if let error = error {
                        let errMap = NSMutableDictionary()
                        errMap["resource"] = resource.filePath
                        errMap["error"] = error.localizedDescription
                        self.tracker.trackError("resource_download_failed", value: errMap)
                    } else if !self.bootTimeoutOccurred {
                        self.moveResourceToMainAndUpdate(resource, singleDownloadHandler: singleDownloadHandler)
                    } else {
                        self.saveResourceToTempFile(resource)
                        let infoMap = NSMutableDictionary()
                        infoMap["resource"] = resource.filePath
                        self.tracker.trackInfo("resource_downloaded_after_timeout", value: infoMap)
                    }

                    group.leave()
                }
            }
        }

        group.notify(queue: globalQueue) { [weak self] in
            guard self != nil else { return }
            downloadCompletion()
        }
    }

    private func moveResourceToMainAndUpdate(_ resource: AJPResource, singleDownloadHandler: @escaping (String, AJPResource) -> Void) {
        moveResourceToMain(resource)
        updateAvailableResource(resource.filePath, withResource: resource)
        collectionsLock.withLock {
            _downloadedSplits.add(resource.filePath)
        }
        var availableDict: [String: AJPResource] = [:]
        collectionsLock.withLock {
            for (key, val) in _availableResources {
                if let k = key as? String, let v = val as? AJPResource {
                    availableDict[k] = v
                }
            }
        }
        updateResources(availableDict)
        singleDownloadHandler(resource.filePath, resource)
    }

    private func saveResourceToTempFile(_ resource: AJPResource) {
        if tempResources == nil {
            tempResources = AJPApplicationResources()
            tempResources?.resources = [:]
        }
        var mutableResources = tempResources?.resources ?? [:]
        mutableResources[resource.filePath] = resource
        tempResources?.resources = mutableResources
        guard let tempRes = tempResources else { return }
        do {
            try fileUtil.writeInstance(tempRes, fileName: AJPApplicationConstants.APP_TEMP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        } catch {
            let map = NSMutableDictionary()
            map["resource"] = resource.filePath
            map["error"] = error.localizedDescription
            tracker.trackError("temp_resource_save_failed", value: map)
        }
    }

    // MARK: - Resource File Preparation Helpers

    private func handleResourceFilePreparationForDownload() {
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

    private func loadOldResourcesForComparison() -> [String: AJPResource] {
        guard let decoded = try? fileUtil.getDecodedInstanceForClass(AJPApplicationResources.self, withContentOfFileName: AJPApplicationConstants.APP_OLD_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationResources else {
            return [:]
        }
        return decoded.resources
    }

    private func filterResourcesForDownloadUsingOld(_ oldResources: [String: AJPResource], newResources: [String: AJPResource]) -> [AJPResource] {
        return newResources.compactMap { (_, newResource) -> AJPResource? in
            shouldDownloadResource(newResource, existingResource: oldResources[newResource.filePath]) ? newResource : nil
        }
    }
}

extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}

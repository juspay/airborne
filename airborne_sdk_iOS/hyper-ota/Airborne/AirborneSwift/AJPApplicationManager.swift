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
@objcMembers public class AJPApplicationManager: NSObject, @unchecked Sendable {
    
    // MARK: - Static Multi-Workspace Map
    
    // Mimics the static NSMutableDictionary `managers` combined with `@synchronized([AJPApplicationManager class])`
    private static let classLock = NSLock()
    private static var managers: [String: AJPApplicationManager] = [:]
    
    private static var isFirstRunAfterInstallation = true
    private static var isFirstRunAfterAppLaunch = true
    
    // MARK: - Internal Locking
    
    private let stateLock = NSLock()
    private let collectionsLock = NSRecursiveLock()
    
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
    private var telemetryEnabled: Bool { delegate?.telemetryEnabled?() ?? false }
    private var sendingReports = false
    private func forbidden(_ version: String) -> Bool {
        bootLock.lock(); defer { bootLock.unlock() }
        return (bootState["securityBlocked"] as? [String] ?? []).contains(version)
    }
    func received(_ manifest: AJPApplicationManifest) {
        bootLock.lock(); defer { bootLock.unlock() }
        let blocked = Array(Set((bootState["securityBlocked"] as? [String] ?? []) + manifest.blockedPackageVersions))
        if !blocked.isEmpty { bootState["securityBlocked"] = blocked }
        if telemetryEnabled, let meta = manifest.telemetry {
            var receipts = bootState["receipts"] as? [String: Any] ?? [:]
            receipts[manifest.package.version] = meta; bootState["receipts"] = receipts
        }
        if !blocked.isEmpty || telemetryEnabled { saveBootState() }
    }
    private func report(_ version: String?, _ kind: String) {
        guard telemetryEnabled, let version = version else { return }
        bootLock.lock(); defer { bootLock.unlock() }
        guard let receipts = bootState["receipts"] as? [String: Any], let meta = receipts[version] as? [String: Any] else { return }
        var queue = bootState["queue"] as? [[String: Any]] ?? []
        queue.append(["meta": meta, "event": ["id": UUID().uuidString, "kind": kind]])
        bootState["queue"] = Array(queue.suffix(128))
        if bootState["install"] == nil { bootState["install"] = UUID().uuidString }
        saveBootState(); flushReports()
    }
    private func flushReports() {
        bootLock.lock(); defer { bootLock.unlock() }
        guard telemetryEnabled && !sendingReports else { return }
        var queue = bootState["queue"] as? [[String: Any]] ?? []
        queue = queue.filter { (($0["meta"] as? [String: Any])?["expires_at"] as? Double ?? 0) > Date().timeIntervalSince1970 }
        bootState["queue"] = queue
        guard let first = queue.first, let meta = first["meta"] as? [String: Any], let token = meta["receipt"] as? String,
              let path = meta["ingest_path"] as? String, let base = URL(string: releaseConfigURL), let endpoint = URL(string: path, relativeTo: base) else { return }
        let batch = Array(queue.filter { ($0["meta"] as? [String: Any])?["receipt"] as? String == token }.prefix(32))
        var request = URLRequest(url: endpoint); request.httpMethod = "POST"; request.timeoutInterval = 5
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["receipt": token, "install_id": bootState["install"] ?? "", "events": batch.compactMap { $0["event"] }])
        sendingReports = true
        URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
            guard let self = self else { return }
            self.bootLock.lock(); defer { self.bootLock.unlock() }
            self.sendingReports = false
            if let code = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(code) || code == 400 {
                let ids = Set(batch.compactMap { ($0["event"] as? [String: String])?["id"] })
                self.bootState["queue"] = (self.bootState["queue"] as? [[String: Any]] ?? []).filter { !ids.contains(($0["event"] as? [String: String])?["id"] ?? "") }
                self.saveBootState()
                self.flushReports()
            }
        }.resume()
    }
    private let bootLock = NSRecursiveLock()
    private var bootState: [String: Any] = [:]
    var telemetryStateURLForTesting: URL { bootStateURL }
    private var bootStateURL: URL {
        let key = workspace.data(using: .utf8)!.base64EncodedString().replacingOccurrences(of: "/", with: "_")
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("airborne-telemetry-\(key).json")
    }
    @discardableResult private func saveBootState() -> Bool {
        do {
            try FileManager.default.createDirectory(at: bootStateURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONSerialization.data(withJSONObject: bootState).write(to: bootStateURL, options: .atomic)
            return true
        } catch { NSLog("Airborne cannot persist telemetry/exclusions: \(error)"); return false }
    }
    func allowPackage(_ version: String) -> Bool {
        if forbidden(version) { report(version, "blocked_package"); return false }
        let allowed = !bootGuard.refusePackage(version, source: "release_config")
        if !allowed { report(version, "blocked_package") }
        return allowed
    }

    private var workspace: String
    private var releaseConfigURL: String
    private var releaseConfigHeaders: [String: String]
    private var baseBundle: Bundle
    private var isLocalAssets: Bool
    private var forceUpdate: Bool
    /// Host-shipped index used when the release config has no index; read from the delegate once at init.
    private let indexBundleName: String

    // MARK: - Boot Guard State

    /// Process-wide opt-in boot guard for this workspace. Its `enabled` flag is fixed when the
    /// first manager for the workspace is created and never re-read from the delegate.
    private let bootGuard: AJPBootGuard
    /// Package from the bundled release_config.json (nil when the app ships none).
    private var bundledPackage: AJPApplicationPackage?
    private var _bootSource: AJPBootSource = .installed
    private var _displacedPackage: AJPApplicationPackage?
    /// Set (under `collectionsLock`) once this manager hands `package` to the JS runtime.
    private var _bootStarted = false

    /// Where the files of `package` are read from in this launch.
    private var bootSource: AJPBootSource {
        get { collectionsLock.withLock { _bootSource } }
        set { collectionsLock.withLock { _bootSource = newValue } }
    }

    /// The installed package whose files are in the package directory while this launch runs a
    /// boot guard fallback instead: the blocked package, or one installed after the fallback booted.
    /// Downloads diff against it, cleanup keeps its files and lazy-split status is recorded on it.
    private var displacedPackage: AJPApplicationPackage? {
        get { collectionsLock.withLock { _displacedPackage } }
        set { collectionsLock.withLock { _displacedPackage = newValue } }
    }

    private weak var delegate: AJPApplicationManagerDelegate?
    
    // Retain these ObjC types until swapped natively
    public var tracker: AJPApplicationTracker!
    public var fileUtil: AJPFileUtil!
    public var remoteFileUtil: AJPRemoteFileUtil!
    private var utils: AJPApplicationManagerUtils!
    
    // Active manifest parts
    private var _currentLazy: [AJPLazyResource] = []
    public var currentLazy: [AJPLazyResource] {
        get { collectionsLock.withLock { _currentLazy } }
        set { collectionsLock.withLock { _currentLazy = newValue } }
    }
    
    private var _downloadedLazy: [AJPLazyResource] = []
    public var downloadedLazy: [AJPLazyResource] {
        get { collectionsLock.withLock { _downloadedLazy } }
        set { collectionsLock.withLock { _downloadedLazy = newValue } }
    }
    
    private var _resources: AJPApplicationResources!
    public var resources: AJPApplicationResources! {
        get { collectionsLock.withLock { _resources } }
        set { collectionsLock.withLock { _resources = newValue } }
    }
    
    private var _tempResources: AJPApplicationResources?
    public var tempResources: AJPApplicationResources? {
        get { collectionsLock.withLock { _tempResources } }
        set { collectionsLock.withLock { _tempResources = newValue } }
    }
    
    private var _config: AJPApplicationConfig!
    public var config: AJPApplicationConfig! {
        get { collectionsLock.withLock { _config } }
        set { collectionsLock.withLock { _config = newValue } }
    }
    
    private var _package: AJPApplicationPackage!
    public var package: AJPApplicationPackage! {
        get { collectionsLock.withLock { _package } }
        set { collectionsLock.withLock { _package = newValue } }
    }
    
    private var _releaseConfigError: String?
    public var releaseConfigError: String? {
        get { stateLock.withLock { _releaseConfigError } }
        set { stateLock.withLock { _releaseConfigError = newValue } }
    }
    
    private var _packageError: String?
    public var packageError: String? {
        get { stateLock.withLock { _packageError } }
        set { stateLock.withLock { _packageError = newValue } }
    }
    
    // MARK: - NSLock Extension (Swift < 5.0 compatibility fallback if needed)
    // Implicitly provided via NSLock standard `lock`/`unlock` internally
    
    // MARK: - Initialization Engine
    
    @objc public class func existingInstance(withWorkspace workspace: String) -> AJPApplicationManager? {
        classLock.lock(); defer { classLock.unlock() }
        return managers[workspace]
    }
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
        self.indexBundleName = delegate?.indexBundleName?() ?? AJPApplicationManager.defaultIndexBundleName
        
        self.startTime = Date().timeIntervalSince1970 * 1000
        let managerId = UUID().uuidString.lowercased()
        self.managerId = managerId

        let tracker = AJPApplicationTracker(managerId: managerId, workspace: workspace)
        tracker.addLogger(logger)
        self.tracker = tracker

        // Read the opt-in flag once, here; later delegate changes (or a released delegate) do not matter.
        self.bootGuard = AJPBootGuard.shared(
            workspace: workspace,
            enabled: delegate?.bootGuardEnabled?() ?? false,
            binaryIdentity: AJPApplicationManager.currentBinaryIdentity(),
            onEvent: { key, value, isError in
                let payload = NSMutableDictionary(dictionary: value)
                if isError {
                    tracker.trackError(key, value: payload)
                } else {
                    tracker.trackInfo(key, value: payload)
                }
            }
        )

        super.init()
        if let data = try? Data(contentsOf: bootStateURL),
           let stored = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { bootState = stored }
        if telemetryEnabled {
            let pending = bootState["telemetryPending"] as? String
            report(pending, "boot_failed")
            if let pending = pending, bootGuard.isBlocked(pending) { report(pending, "rollback") }
            bootState.removeValue(forKey: "telemetryPending"); saveBootState(); flushReports()
        }

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
            #if SWIFT_PACKAGE
            networkClient.logger = self.tracker as! AJPLoggerDelegate
            #else
            networkClient.logger = self.tracker as AJPLoggerDelegate
            #endif
            self.remoteFileUtil = AJPRemoteFileUtil(networkClient: networkClient)
        }
        
        self.utils = AJPApplicationManagerUtils(fileUtil: self.fileUtil, tracker: self.tracker, remoteFileUtil: self.remoteFileUtil)

        let appVersion = AJPApplicationManager.currentBinaryIdentity()

        let storedVersion = UserDefaults.standard.string(forKey: AJPApplicationConstants.APP_VERSION_USER_DEFAULTS_KEY)
        let storedVersionLog = NSMutableDictionary()
        storedVersionLog["stored_version"] = storedVersion ?? "nil"
        storedVersionLog["current_version"] = appVersion
        self.tracker.trackInfo("app_version", value: storedVersionLog)

        if storedVersion != appVersion {
            self.utils.cleanupManifestDirectory()
            self.utils.cleanupPackageDirectory()

            let cleanupLog = NSMutableDictionary()
            cleanupLog["previous_version"] = storedVersion ?? "nil"
            cleanupLog["current_version"] = appVersion
            self.tracker.trackInfo("app_version_changed_cleanup", value: cleanupLog)
        }

        UserDefaults.standard.set(appVersion, forKey: AJPApplicationConstants.APP_VERSION_USER_DEFAULTS_KEY)
        
        if bootGuard.enabled {
            self.bundledPackage = self.readBundledPackage()
        }

        // Handle if any previously downloaded packages are available.
        self.handleTempPackageInstallation()
        
        self.package = self.readApplicationPackage()
        self.selectBootPackage()
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
        
        // Check if any app-pkg-temp.dat file is available in JuspayManifest.
        // If yes, a temporary package exists, which means an update was timedout.
        let tempPackagePath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        guard FileManager.default.fileExists(atPath: tempPackagePath) else {
            return
        }
        
        do {
            // Read temp package data
            guard let tempPackage = try fileUtil.getDecodedInstanceForClass(AJPApplicationPackage.self, withContentOfFileName: AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationPackage else {
                return
            }
            
            // A staged package naming the blocked version must never be installed.
            if !allowPackage(tempPackage.version) {
                try? fileUtil.deleteFile(AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
                utils.cleanupTempDirectory()
                return
            }
            
            // Move all files from temp to main
            bootGuard.packageInstallStarted()
            let tempFiles = utils.getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_PACKAGE_DIR, subFolder: AJPApplicationConstants.JUSPAY_TEMP_DIR, includeSubfolders: true)
            var allMoveSuccessful = true
            
            let infoMap = NSMutableDictionary()
            infoMap["count"] = tempFiles.count
            tracker.trackInfo("temp_package_installation_started", value: infoMap)
            var error: NSError? = nil
            for fileName in tempFiles {
                let success = utils.movePackageFromTempToMain(fileName, error: &error)
                if !success {
                    allMoveSuccessful = false
                    let errMap = NSMutableDictionary()
                    errMap["file"] = fileName
                    errMap["error"] = error?.localizedDescription ?? "Unknown error"
                    tracker.trackError("file_move_failed", value: errMap)
                }
            }
            
            // If files were moved successfully, update the package data
            if allMoveSuccessful {
                do {
                    try fileUtil.writeInstance(tempPackage, fileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
                    let sMap = NSMutableDictionary()
                    sMap["version"] = tempPackage.version
                    tracker.trackInfo("temp_package_installed", value: sMap)
                    self.notifyBootGuardOfInstall(tempPackage)
                } catch {
                    let fMap = NSMutableDictionary()
                    fMap["error"] = error.localizedDescription
                    tracker.trackError("temp_package_write_failed", value: fMap)
                }
            }
            
            // Clean up the temp package file and directory
            try? fileUtil.deleteFile(AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
            utils.cleanupTempDirectory()
        } catch {
            // Failed to read temp package, clean up
            let logVal = NSMutableDictionary()
            logVal["error"] = error.localizedDescription
            tracker.trackError("temp_package_read_failed", value: logVal)
            try? fileUtil.deleteFile(AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        }
    }
    
    private func handleTempResourcesInstallation() {
        // Check if temp resources file exists
        let tempResourcesPath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_TEMP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        guard FileManager.default.fileExists(atPath: tempResourcesPath) else {
            return
        }
        
        do {
            // Read temp resources data
            guard let tempResources = try fileUtil.getDecodedInstanceForClass(AJPApplicationResources.self, withContentOfFileName: AJPApplicationConstants.APP_TEMP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationResources else {
                return
            }
            
            let sMap = NSMutableDictionary()
            sMap["count"] = tempResources.resources.count
            tracker.trackInfo("temp_resources_installation_started", value: sMap)
            
            var updatedAvailableResources = self.resources.resources
            
            // Move all resources from temp to main
            for (_, resource) in tempResources.resources {
                utils.moveResourceToMain(resource)
                updatedAvailableResources[resource.filePath] = resource
            }
            
            // Update active resources state with moved files
            self.resources.resources = updatedAvailableResources
            self.updateResources(updatedAvailableResources)
            
            let cMap = NSMutableDictionary()
            cMap["count"] = tempResources.resources.count
            tracker.trackInfo("temp_resources_installed", value: cMap)
            
            // Clean up the temp resources file
            try? fileUtil.deleteFile(AJPApplicationConstants.APP_TEMP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        } catch {
            // Failed to read temp resources, clean up
            let map = NSMutableDictionary()
            map["error"] = error.localizedDescription
            tracker.trackError("temp_resources_read_failed", value: map)
            try? fileUtil.deleteFile(AJPApplicationConstants.APP_TEMP_RESOURCES_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        }
    }
    
    private func initializeLazyResourcesDownloadStatus() {
        let storedPackagePath = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        AJPApplicationManager.isFirstRunAfterInstallation = !FileManager.default.fileExists(atPath: storedPackagePath)
        
        // First, check if this is a bundle-loaded package (first run)
        if self.package.lazy.count > 0, !FileManager.default.fileExists(atPath: storedPackagePath) {
            let updatedLazy = self.package.lazy
            for resource in updatedLazy {
                // For first run, all lazy packages in the bundle are assumed to be available
                resource.isDownloaded = true
            }
            self.package.lazy = updatedLazy
            
            // Save the updated package to disk
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
        bootLock.lock()
        let blocked = bootState["securityBlocked"] as? [String] ?? []
        let receipts = bootState["receipts"] as? [String: Any] ?? [:]
        bootLock.unlock()
        return collectionsLock.withLock {
            let manifest = AJPApplicationManifest(package: self.package, config: self.config, resources: self.resources)
            manifest.blockedPackageVersions = blocked
            manifest.telemetry = receipts[package.version] as? [String: Any]
            return manifest
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
        var shouldCallImmediately = false
        stateLock.withLock {
            let isPkgResDone = utils.isDownloadCompleted(_importantPackageDownloadStatus) && utils.isDownloadCompleted(_resourceDownloadStatus)
            let isRelConfDone = utils.isDownloadCompleted(_releaseConfigDownloadStatus)
            
            if isPkgResDone && isRelConfDone {
                shouldCallImmediately = true
            } else {
                self.packagesCompletionHandler = completion
                
                let center = NotificationCenter.default
                if let observer = self.packageResourceObserver {
                    center.removeObserver(observer)
                }
                
                self.packageResourceObserver = center.addObserver(forName: AJPApplicationConstants.PACKAGE_RESOURCE_NOTIFICATION, object: nil, queue: OperationQueue()) { [weak self] note in
                    self?.handlePackageResourceCompletion()
                }
            }
        }
        
        if shouldCallImmediately {
            completion(getCurrentResult())
        }
    }
    
    private func handlePackageResourceCompletion() {
        var handler: PackagesCompletionHandler?
        stateLock.withLock {
            if let h = packagesCompletionHandler {
                handler = h
                packagesCompletionHandler = nil
                if let observer = packageResourceObserver {
                    NotificationCenter.default.removeObserver(observer)
                    packageResourceObserver = nil
                }
            }
        }
        handler?(getCurrentResult())
    }
    
    /**
     * Reads a file of the current package as UTF-8.
     *
     * `fileName` is relative to the package directory (as in the release config). Absolute paths
     * and paths with a ".." component are rejected (logged, nil), since this is reachable from JS.
     */
    @objc public func readPackageFile(_ fileName: String) -> String? {
        if !AJPApplicationManager.isPackageRelativePath(fileName) {
            let map = NSMutableDictionary()
            map["fileName"] = fileName
            map["error"] = "path is absolute or leaves the package directory"
            tracker.trackError("read_package_file", value: map)
            return nil
        }
        if bootSource != .installed {
            // The boot guard substituted a snapshot or the bundled package for a blocked one
            // (release config resources are still read from the package directory).
            let path = getPathForPackageFile(fileName)
            if !path.isEmpty, let content = try? String(contentsOfFile: path, encoding: .utf8) {
                return content
            }
            let map = NSMutableDictionary()
            map["fileName"] = fileName.isEmpty ? "nil" : fileName
            map["error"] = "file not found in boot guard fallback"
            tracker.trackError("read_package_file", value: map)
            return nil
        }
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

    /// Whether `path` is relative and has no ".." component, so it cannot leave the package directory.
    /// The one path rule for package files: `AJPBootGuard.containedURL` (snapshot and fallback
    /// paths) applies it too.
    static func isPackageRelativePath(_ path: String) -> Bool {
        // Split on code points, not Characters: a combining mark after "/" would merge with it
        // into one Character and hide the separator from a Character-based split.
        let scalars = path.unicodeScalars
        if scalars.first == "/" {
            return false
        }
        return !scalars.split(separator: "/").contains { $0.elementsEqual("..".unicodeScalars) }
    }

    /**
     * Serializes the current release config (config, package, resources) as JSON.
     *
     * Shared by `AirborneServices.getReleaseConfig()` and the React Native bridge.
     * Returns nil (and logs) when the manifest cannot be serialized.
     */
    @objc(currentReleaseConfigJSONPrettyPrinted:)
    public func currentReleaseConfigJSON(prettyPrinted: Bool) -> String? {
        guard let manifest = getCurrentApplicationManifest() as? AJPApplicationManifest else {
            return nil
        }
        let dictionary = manifest.toDictionary()
        // JSONSerialization raises an Objective-C exception (not a Swift error) for invalid objects.
        guard JSONSerialization.isValidJSONObject(dictionary) else {
            tracker.trackError("release_config_serialization_failed", value: NSMutableDictionary(dictionary: ["error": "release config is not valid JSON"]))
            return nil
        }
        do {
            let data = try JSONSerialization.data(withJSONObject: dictionary, options: prettyPrinted ? .prettyPrinted : [])
            return String(data: data, encoding: .utf8)
        } catch {
            tracker.trackError("release_config_serialization_failed", value: NSMutableDictionary(dictionary: ["error": error.localizedDescription]))
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
    
    /**
     * Returns the URL of the JS index to hand to the JS runtime.
     *
     * Resolution order: the current package's index file on disk, then a file of the same name in
     * the base bundle, then the host's `indexBundleName` when the release config has no index.
     * `AirborneServices.getIndexBundlePath()` (and so `startApp`) resolves through here.
     *
     * The first call in a process also records the boot for the opt-in boot guard (`prepareBoot()`),
     * so call it only to load the bundle. To merely report the path, use `currentIndexBundleURL()`.
     */
    @objc public func getIndexBundleURL() -> URL {
        prepareBoot()
        return currentIndexBundleURL()
    }

    /**
     * Same resolution as `getIndexBundleURL()`, without recording a boot for the boot guard.
     * Used by the React Native bridge's `getBundlePath`, which JS may call at any time.
     */
    @objc public func currentIndexBundleURL() -> URL {
        let indexFilePath = package.index.filePath
        if indexFilePath.isEmpty {
            return hostIndexBundleURL()
        }

        let path = getPathForPackageFile(indexFilePath)
        if !path.isEmpty && FileManager.default.fileExists(atPath: path) {
            return URL(fileURLWithPath: path)
        }

        if let bundledPath = pathInBaseBundle(forFileName: indexFilePath) {
            return URL(fileURLWithPath: bundledPath)
        }
        return baseBundle.bundleURL.appendingPathComponent(indexFilePath)
    }

    /**
     * Returns the absolute path of a file of the package selected for this launch.
     *
     * Normally this is the OTA package directory. When the boot guard replaced a blocked package,
     * it is the last-good snapshot or the app bundle instead; release config resources missing
     * there are still read from the package directory (snapshots hold package files only). Returns
     * "" when the file cannot be located (callers must check before building a file URL).
     */
    @objc public func getPathForPackageFile(_ fileName: String) -> String {
        let fallbackPath: String
        switch bootSource {
        case .snapshot(let directory):
            fallbackPath = AJPBootGuard.containedURL(fileName, in: directory)?.path ?? ""
        case .appBundle:
            let bundledFileName = (fileName as NSString).lastPathComponent
            fallbackPath = fileUtil.filePathInBundleForFileName(bundledFileName) ?? ""
        case .installed:
            return installedFilePath(fileName)
        }
        if !fallbackPath.isEmpty && FileManager.default.fileExists(atPath: fallbackPath) {
            return fallbackPath
        }
        if isInstalledResourceOutsidePackages(fileName) {
            return installedFilePath(fileName)
        }
        return fallbackPath
    }

    /**
     * Whether `fileName` may be read from the package directory while a boot guard fallback runs:
     * it names a resource of the release config (resources are downloaded into the package
     * directory and are not part of a snapshot) and no file of the running or the installed
     * (displaced, possibly blocked) package, so a blocked package's files are never served.
     */
    private func isInstalledResourceOutsidePackages(_ fileName: String) -> Bool {
        guard AJPApplicationManager.isPackageRelativePath(fileName) else {
            return false
        }
        let names = { (path: String) -> [String] in [path, self.utils.jsFileName(for: path)] }
        return collectionsLock.withLock { () -> Bool in
            var resourcePaths = self._availableResources.allKeys.compactMap { $0 as? String }
            if let resources = self._resources {
                resourcePaths += Array(resources.resources.keys)
            }
            guard resourcePaths.contains(where: { names($0).contains(fileName) }) else {
                return false
            }
            let packages = [self._package, self._displacedPackage].compactMap { $0 }
            for package in packages {
                if package.allSplits().contains(where: { names($0.filePath).contains(fileName) }) {
                    return false
                }
            }
            return true
        }
    }

    private func installedFilePath(_ fileName: String) -> String {
        let filePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(fileName)
        return fileUtil.fullPathInStorageForFilePath(filePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
    }

    /// Directory holding installed package files (`<package dir>/<workspace>/main`).
    private func installedPackageDirectory() -> URL {
        let path = fileUtil.fullPathInStorageForFilePath(AJPApplicationConstants.JUSPAY_MAIN_DIR, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func hostIndexBundleURL() -> URL {
        return AJPApplicationManager.hostIndexBundleURL(indexBundleName: indexBundleName, in: baseBundle)
    }

    /// The host-shipped index in `bundle`: a resource named `indexBundleName`, or that name under the bundle URL.
    static func hostIndexBundleURL(indexBundleName: String, in bundle: Bundle) -> URL {
        let components = indexBundleName.split(separator: ".", maxSplits: 1)
        let name = components.first.map(String.init) ?? indexBundleName
        let fileExtension = components.dropFirst().first.map(String.init) ?? ""
        return bundle.url(forResource: name, withExtension: fileExtension)
            ?? bundle.bundleURL.appendingPathComponent(indexBundleName)
    }

    private func pathInBaseBundle(forFileName fileName: String) -> String? {
        let components = fileName.components(separatedBy: ".")
        guard components.count > 1, let fileExtension = components.last else {
            return nil
        }
        let name = components.dropLast().joined(separator: ".")
        return baseBundle.path(forResource: name, ofType: fileExtension)
    }

    // MARK: - Boot Guard

    /// Default host index name when neither the release config nor the delegate names one.
    static let defaultIndexBundleName = "main.jsbundle"

    /// App binary identity (`CFBundleShortVersionString.CFBundleVersion`).
    static func currentBinaryIdentity() -> String {
        let majorVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let minorVersion = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        return "\(majorVersion).\(minorVersion)"
    }

    /**
     * Records that the current package is being handed to the JS runtime (opt-in boot guard).
     *
     * Called by `getIndexBundleURL()`. Only the first call in a process counts, so repeated
     * bundle-path lookups and background launches that never load JS do not count against a
     * release. Boots of the bundled package, or of a package whose index file is missing, are not
     * tracked. No-op when the boot guard is off.
     */
    @objc public func prepareBoot() {
        guard bootGuard.enabled || telemetryEnabled else { return }
        let session = bootGuard.bootSession ?? makeBootSession()
        if session.tracked && telemetryEnabled {
            bootLock.lock(); defer { bootLock.unlock() }
            if bootState["telemetryPending"] as? String != session.package.version {
                report(session.package.version, "boot_started")
                bootState["telemetryPending"] = session.package.version; saveBootState()
            }
        }
        guard bootGuard.enabled, !bootGuard.hasBootSession else { return }
        bootGuard.beginBoot(session)
    }

    /**
     * Acknowledges that the JS booted by this process rendered successfully (opt-in boot guard).
     *
     * Clears the unacknowledged-boot count on the calling thread. Keeping a snapshot of the booted
     * package's files as the last-good fallback (first acknowledgement of a package, or lazy files
     * downloaded since its snapshot) runs on a background queue. Never throws or crashes; snapshot
     * failures are reported through the tracker. No-op when the boot guard is off.
     */
    @objc public func markBootSuccess() {
        guard bootGuard.enabled || telemetryEnabled else { return }
        let session = bootGuard.bootSession ?? makeBootSession()
        if session.tracked { report(session.package.version, "boot_success") }
        if telemetryEnabled { bootLock.lock(); bootState.removeValue(forKey: "telemetryPending"); saveBootState(); bootLock.unlock() }
        bootGuard.markBootSuccess()
    }

    /// Blocks until a snapshot started by `markBootSuccess()` has finished. For tests only.
    func waitForBootGuardSnapshotForTesting() {
        bootGuard.waitForSnapshotForTesting()
    }

    /// Lets the next manager run the once-per-process package directory cleanup again. For tests only.
    static func resetFirstRunAfterAppLaunchForTesting() {
        isFirstRunAfterAppLaunch = true
    }

    /// Where this launch reads package files from. For tests only.
    var bootSourceForTesting: AJPBootSource {
        bootSource
    }

    private func makeBootSession() -> AJPBootSession {
        let (bootPackage, source) = collectionsLock.withLock { () -> (AJPApplicationPackage, AJPBootSource) in
            self._bootStarted = true
            return (self._package!, self._bootSource)
        }
        let indexFilePath = bootPackage.index.filePath

        switch source {
        case .appBundle:
            return AJPBootSession(package: bootPackage, tracked: false, source: source, sourceDirectory: nil)

        case .snapshot(let directory):
            let indexURL = indexFilePath.isEmpty ? nil : AJPBootGuard.containedURL(indexFilePath, in: directory)
            let indexExists = indexURL.map { FileManager.default.fileExists(atPath: $0.path) } ?? false
            return AJPBootSession(package: bootPackage, tracked: indexExists, source: source, sourceDirectory: nil)

        case .installed:
            // Mirrors Android: only a package whose index file is on disk is an OTA boot.
            let indexExists = !indexFilePath.isEmpty
                && FileManager.default.fileExists(atPath: installedFilePath(indexFilePath))
            return AJPBootSession(
                package: bootPackage,
                tracked: indexExists,
                source: source,
                sourceDirectory: installedPackageDirectory()
            )
        }
    }

    private func readBundledPackage() -> AJPApplicationPackage? {
        guard let data = try? fileUtil.getFileDataFromBundle("release_config.json"),
              let manifest = try? AJPApplicationManifest(data: data as NSData) else {
            return nil
        }
        return manifest.package
    }

    /**
     * Chooses the package this manager serves, after `package` was read from the package directory.
     *
     * `getSharedInstance` replaces a manager whose downloads finished, and the JS booted by this
     * process is then served by the new manager (`existingInstance(withWorkspace:)`). So once this
     * process booted a boot guard fallback, every later manager adopts that boot's package and
     * source instead of re-deriving them: an install since the boot may have lifted the block, but
     * the running JS must keep reading the files it booted with. The installed package becomes the
     * displaced one, as in the manager that booted.
     *
     * A boot from the package directory needs no adoption: installs replace that package in place
     * (as with the guard off), and re-deriving cannot pick a fallback, since a block is only set at
     * launch and installs of the blocked version are refused.
     */
    private func selectBootPackage() {
        guard let session = bootGuard.bootSession, session.source != .installed else {
            substituteBlockedPackage()
            return
        }
        let installed: AJPApplicationPackage? = self.package
        self.package = session.package
        self.bootSource = session.source
        // An empty package (no version, no splits) when nothing is installed: downloads diff
        // against no files rather than against the fallback's.
        self.displacedPackage = installed ?? AJPApplicationPackage()
    }

    /// Replaces a blocked installed package with the last-good snapshot, else the bundled package.
    private func substituteBlockedPackage() {
        guard let installed = self.package, forbidden(installed.version) || bootGuard.isBlocked(installed.version) else { return }
        report(installed.version, "blocked_package")
        bootGuard.reportBlockedPackage(installed.version, source: "installed")

        if let fallback = bootGuard.lastGoodFallback(), !forbidden(fallback.package.version) {
            self.package = fallback.package
            self.bootSource = .snapshot(fallback.directory)
        } else {
            self.package = bundledPackage ?? AJPApplicationPackage()
            self.bootSource = .appBundle
        }
        self.displacedPackage = installed
    }

    /// Lets the guard clear its block once a server-delivered package is installed with its index on disk.
    private func notifyBootGuardOfInstall(_ package: AJPApplicationPackage) {
        let indexFilePath = package.index.filePath
        guard !indexFilePath.isEmpty,
              FileManager.default.fileExists(atPath: installedFilePath(indexFilePath)) else {
            return
        }
        report(package.version, "package_downloaded")
        bootGuard.packageInstalled(package.version)
    }
    
    @objc public func getPathForAssetsInReleaseConfig(_ resourcePath: String?) -> String? {
        guard let path = resourcePath, !path.isEmpty else { return nil }
        
        var isAvailable = false
        collectionsLock.withLock {
            isAvailable = _downloadedSplits.contains(path)
        }
        
        let resolvedFileName = utils.jsFileName(for: path)
        let packagePath = getPathForPackageFile(resolvedFileName)
        
        if isAvailable && FileManager.default.fileExists(atPath: packagePath) {
            return packagePath
        }
        
        let bundledFileName = (resolvedFileName as NSString).lastPathComponent
            
        if let bundledPath = fileUtil.filePathInBundleForFileName(bundledFileName),
           FileManager.default.fileExists(atPath: bundledPath) {
            return bundledPath
        }
        
        return nil
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
    
    // Internal (not private) so tests can install a package while a boot guard fallback runs.
    func updatePackage(_ package: AJPApplicationPackage, didDownloadImportant: Bool, startTime: TimeInterval) {
        let logVal = NSMutableDictionary()
        logVal["trying_to_install_package"] = "New app version downloaded, installing to disk. \(package.version)"
        tracker.trackInfo("app_update_result", value: logVal)
        
        // Release configs naming the blocked version are already refused; this guards any other path.
        if !allowPackage(package.version) {
            return
        }

        // Only write to disk if no important downloads happened OR if all files are successfully downloaded & moved to main
        if !didDownloadImportant || utils.isAppInstalled(withPackage: package, inSubFolder: AJPApplicationConstants.JUSPAY_MAIN_DIR) {
            do {
                bootGuard.packageInstallStarted()
                // Save the new package data to disk
                try fileUtil.writeInstance(package, fileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)

                // Read outside collectionsLock: the guard's lock is never taken inside it.
                let bootedInThisProcess = bootGuard.hasBootSession
                collectionsLock.withLock {
                    if (bootedInThisProcess || self._bootStarted) && self._bootSource != .installed {
                        // The JS of this launch already runs a boot guard fallback; keep serving its
                        // files. The new package is in the package directory for the next launch.
                        self._displacedPackage = package
                    } else {
                        // Update current package state (it is read from the package directory from now on)
                        self._package = package
                        self._bootSource = .installed
                        self._displacedPackage = nil
                    }
                }
                self.notifyBootGuardOfInstall(package)
                
                let resultLog = NSMutableDictionary()
                resultLog["package_version"] = package.version
                resultLog["result"] = "SUCCESS"
                resultLog["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                resultLog["resource_download_status"] = utils.getStatusString(self.resourceDownloadStatus)
                tracker.trackInfo("package_update_result", value: resultLog)
                
            } catch {
                // Failed to save the package data
                let errLog = NSMutableDictionary()
                errLog["error"] = error.localizedDescription
                errLog["result"] = "FAILED"
                errLog["file_name"] = AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME
                errLog["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                tracker.trackInfo("package_update_result", value: errLog)
            }
        } else {
            // Package installation unsuccessful (files missing)
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
        // Only process if the new config has a different version
        if config.version != self.config.version {
            do {
                // Save the new config data to disk
                try fileUtil.writeInstance(config, fileName: AJPApplicationConstants.APP_CONFIG_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
                
                // Update current config state
                self.config = config
                let logData = NSMutableDictionary()
                logData["new_config_version"] = config.version
                tracker.trackInfo("config_updated", value: logData)
            } catch {
                // Failed to write new config to disk
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
    
    private func cleanUpUnwantedFiles() {
        if AJPApplicationManager.isFirstRunAfterAppLaunch {
            AJPApplicationManager.isFirstRunAfterAppLaunch = false
            
            let allPackageFiles = utils.getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_PACKAGE_DIR, subFolder: AJPApplicationConstants.JUSPAY_MAIN_DIR, includeSubfolders: true)
            var requiredFiles = Set<String>()
            
            for resource in self.package.allSplits() {
                requiredFiles.insert(utils.jsFileName(for: resource.filePath))
            }

            // Boot guard snapshots live outside the package directory, but the blocked package
            // still installed there is the baseline for the next download, so keep its files.
            if let displaced = self.displacedPackage {
                for resource in displaced.allSplits() {
                    requiredFiles.insert(utils.jsFileName(for: resource.filePath))
                }
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
                    utils.deleteFile(fileName, subFolder: AJPApplicationConstants.JUSPAY_MAIN_DIR, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
                }
            }
            
            let resourceFileNames = utils.getAllFilesInDirectory(AJPApplicationConstants.JUSPAY_RESOURCE_DIR, subFolder: "", includeSubfolders: true)
            for fileName in resourceFileNames {
                utils.deleteFile(fileName, subFolder: "", inFolder: AJPApplicationConstants.JUSPAY_RESOURCE_DIR)
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
            if let manifest = manifest { self.received(manifest) }
            
            if let manifest = manifest, !self.allowPackage(manifest.package.version) {
                // Name the installed package instead (so nothing is downloaded or installed, and the
                // block stays); the config and resources of this release config still apply.
                manifest.package = self.displacedPackage ?? self.package
            }
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
    
    /**
     * Raised alongside the `downloads_completed_after_timeout` event: the package finished
     * downloading after the boot timeout elapsed, so it is staged and installs on the next Airborne
     * initialization. The app is still running `oldVersion` — prompt for a reload to apply it.
     *
     * Not raised when the package installs within the boot timeout; there is nothing to reload for.
     */
    private func notifyPackageDownloaded(oldVersion: String, newVersion: String) {
        self.delegate?.onPackageDownloaded?(
            oldVersion: oldVersion,
            newVersion: newVersion
        )
    }

    private func tryDownloadingUpdate() {
        guard let downloadedManifest = self.downloadedApplicationManifest else { return }
        
        // Package download
        Task { [weak self] in
            guard let self = self else { return }
            // Compare and diff against the package actually in the package directory. When the boot
            // guard replaced a blocked package, that is the blocked (displaced) package, not the
            // fallback this launch runs: a server rolling back to the fallback's version must get
            // it installed (which lifts the block) for the next launch.
            let installedPackage: AJPApplicationPackage = self.displacedPackage ?? self.package
            // Download important packages first
            if !(installedPackage.version == downloadedManifest.package.version && installedPackage.name == downloadedManifest.package.name) {
                self.startBootTimeoutTimer()

                let currentLazy = installedPackage.lazy
                self.collectionsLock.withLock {
                    self.downloadedLazy = downloadedManifest.package.lazy
                }
                
                // Captured before the download call, which installs the new package (and so
                // overwrites self.package) when the boot timeout has not elapsed.
                let currentPackageVersion = self.package.version

                let (downloadFailed, timedOut) = await self.downloadImportantPackagesWithNewManifest(downloadedManifest.package, currentManifest: installedPackage, runningVersion: currentPackageVersion)

                if !downloadFailed { // Important packages downloaded successfully/No updates.
                    self.didFinishImportantPackageWithLazyDownloadComplete(timedOut)
                    
                    if timedOut {
                        await self.retryFailedLazyDownloadsAsync()
                        let downloadedLazyCopy = self.collectionsLock.withLock { self.downloadedLazy.compactMap { $0 } }
                        let toDownload = utils.getResourcesFrom(downloadedLazyCopy, filtering: currentLazy, isFirstRunAfterInstallation: AJPApplicationManager.isFirstRunAfterInstallation)
                        let packageVersion = self.downloadedApplicationManifest?.package.version ?? ""
                        
                        await self.downloadLazyPackageResources(toDownload, version: packageVersion, singleDownloadHandler: { [weak self] status, resource in
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
                        })
                        
                        self.collectionsLock.withLock {
                            self.downloadedApplicationManifest?.package.lazy = self.downloadedLazy.compactMap { $0 }
                        }
                        if let pkg = self.downloadedApplicationManifest?.package {
                            utils.updatePackageInTemp(pkg)
                        }
                    } else {
                        let downloadedLazyCopy = self.collectionsLock.withLock { self.downloadedLazy.compactMap { $0 } }
                        let toDownload = utils.getResourcesFrom(downloadedLazyCopy, filtering: currentLazy, isFirstRunAfterInstallation: AJPApplicationManager.isFirstRunAfterInstallation)
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
                        await self.downloadLazyPackageResources(toDownload, version: packageVersion, singleDownloadHandler: { [weak self] status, resource in
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
                        })
                        NotificationCenter.default.post(name: AJPApplicationConstants.LAZY_PACKAGE_NOTIFICATION, object: nil, userInfo: ["lazyDownloadsComplete": true])
                    }
                } else {
                    self.didFinishImportantPackageWithLazyDownloadComplete(true)
                    self.retryFailedLazyDownloads()
                }
            } else {
                tracker.trackInfo("package_update_info", value: NSMutableDictionary(dictionary: ["package_splits_download": "No updates in app"]))
                self.didFinishImportantPackageWithLazyDownloadComplete(true)
                self.retryFailedLazyDownloads()
            }
        }

        // Resource download
        Task { [weak self] in
            guard let self = self else { return }
            await self.downloadResourcesWithCurrentResources(
                self.resources.resources,
                newResources: downloadedManifest.resources.resources,
                singleDownloadHandler: { [weak self] key, _ in
                    self?.tracker.trackInfo("resource_download_completed", value: NSMutableDictionary(dictionary: ["resource": key]))
                }
            )
            
            self.resourceDownloadStatus = .completed
            self.fireCallbacks()
        }
    }
    
    private func fetchReleaseConfigWithCompletionHandler(_ completionHandler: @escaping AJPReleaseConfigCompletionHandler) {
        
        var timeoutObserver: Any? = nil
        timeoutObserver = NotificationCenter.default.addObserver(forName: AJPApplicationConstants.RELEASE_CONFIG_TIMEOUT_NOTIFICATION, object: nil, queue: OperationQueue()) { [weak self] note in
            guard let self = self else { return }
            
            if let observer = timeoutObserver {
                NotificationCenter.default.removeObserver(observer)
            }
            
            let tempManifest = utils.readTempManifest()
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
        
        var components = URLComponents(string: self.releaseConfigURL)
        if telemetryEnabled {
            var items = components?.queryItems ?? []
            items += [URLQueryItem(name: "telemetry_platform", value: "ios"), URLQueryItem(name: "native_version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown")]
            components?.queryItems = items
        }
        guard let manifestUrl = components?.url else {
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
        for (key, value) in self.releaseConfigHeaders {
            dimensions.append("\(key)=\(value);")
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
                    utils.deleteTempManifest()
                    completionHandler(manifest, manifestError, false)
                } else {
                    if let manifest = manifest, manifestError == nil {
                        self.tracker.trackInfo("release_config_fetch_after_timeout", value: NSMutableDictionary(dictionary: ["version": manifest.config.version]))
                        utils.saveManifestToTemp(manifest)
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
    
    private func downloadImportantPackagesWithNewManifest(_ newManifest: AJPApplicationPackage, currentManifest: AJPApplicationPackage, runningVersion: String) async -> (downloadFailed: Bool, timedOut: Bool) {
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
                    map["importantPackageDownloadCompleted"] = self.utils.isDownloadCompleted(self.importantPackageDownloadStatus)
                    map["resourcesDownloadCompleted"] = self.utils.isDownloadCompleted(self.resourceDownloadStatus)
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
            return (false, false)
        }
        
        var pendingDownloads = Set(toDownload.map { $0.filePath })
        var failedDownloads = Set<String>()
        
        await withTaskGroup(of: Void.self) { group in
            for split in toDownload {
                group.addTask { [weak self] in
                    guard let self = self else { return }
                    
                    let fileName = (split.url.pathExtension == "zip") ? split.url.lastPathComponent : split.filePath
                    let tempPath = "\(AJPApplicationConstants.JUSPAY_TEMP_DIR)/\(fileName)"
                    
                    do {
                        try await self.utils.downloadFileFromURL(split.url, andSaveInFilePath: tempPath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR, checksum: split.checksum)
                        let _ = downloadLock.withLock {
                            pendingDownloads.remove(split.filePath)
                        }
                    } catch {
                        downloadLock.withLock {
                            failedDownloads.insert(split.filePath)
                            let map = NSMutableDictionary()
                            map["file"] = split.filePath
                            map["error"] = error.localizedDescription
                            self.tracker.trackError("important_package_download_error", value: map)
                        }
                    }
                }
            }
        }
        
        var resultDownloadFailed = false
        var resultTimedOut = timeoutOccurred
        
        downloadLock.withLock {
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
                resultDownloadFailed = true
            } else if timeoutOccurred || !self.forceUpdate {
                let map = NSMutableDictionary()
                map["timeoutOccurred"] = timeoutOccurred
                map["forceUpdate"] = self.forceUpdate
                map["failed_downloads"] = Array(failedDownloads)
                map["all_successful"] = failedDownloads.isEmpty
                map["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                // The package is on disk but was not installed this boot; it is staged for the next
                // Airborne init. Integrators prompt for a reload on this event.
                map["package_version"] = newManifest.version
                map["current_package_version"] = runningVersion
                self.tracker.trackInfo("downloads_completed_after_timeout", value: map)

                self.notifyPackageDownloaded(
                    oldVersion: runningVersion,
                    newVersion: newManifest.version
                )
                
                resultDownloadFailed = false
                resultTimedOut = true
            } else {
                let map = NSMutableDictionary()
                map["result"] = "SUCCESS"
                map["reason"] = "important"
                map["boot_timeout"] = self.getPackageTimeout()
                map["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                self.tracker.trackInfo("important_package_download_result", value: map)

                // The package directory stops matching the package booted in this process.
                bootGuard.packageInstallStarted()
                utils.moveAllPackagesFromTempToMain()
                self.updatePackage(newManifest, didDownloadImportant: true, startTime: startTime)
                
                let map2 = NSMutableDictionary()
                map2["result"] = "SUCCESS"
                map2["boot_timeout"] = self.getPackageTimeout()
                map2["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
                self.tracker.trackInfo("important_package_update_result", value: map2)
                
                resultDownloadFailed = false
                resultTimedOut = false
            }
        }
        
        if let obs = timeoutObserver { NotificationCenter.default.removeObserver(obs) }
        
        return (resultDownloadFailed, resultTimedOut)
    }
    
    private func moveLazyPackageFromTempToMain(_ resource: AJPLazyResource) {
        let fileName = resource.filePath
        do {
            try utils.movePackageFromTempToMain(fileName)
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
    
    private func downloadLazyPackageResources(_ resourcesToDownload: [AJPResource], version: String, singleDownloadHandler: @escaping (Bool, AJPResource) -> Void) async {
        let startTime = Date().timeIntervalSince1970 * 1000
        if resourcesToDownload.isEmpty {
            self.tracker.trackInfo("package_update_info", value: NSMutableDictionary(dictionary: ["lazy_splits_download": "No new lazy splits available"]))
            self.lazyPackageDownloadStatus = .completed
            return
        }
        
        self.tracker.trackInfo("lazy_package_download_started", value: NSMutableDictionary(dictionary: ["package_version": version]))
        
        await withTaskGroup(of: Void.self) { group in
            let maxConcurrentTasks = 5
            
            for (index, split) in resourcesToDownload.enumerated() {
                if index >= maxConcurrentTasks {
                    await group.next()
                }
                
                group.addTask { [weak self] in
                    guard let self = self else {
                        singleDownloadHandler(false, split)
                        return
                    }
                    
                    let tempFilePath = "\(AJPApplicationConstants.JUSPAY_TEMP_DIR)/\(split.filePath)"
                    
                    do {
                        try await self.utils.downloadFileFromURL(split.url, andSaveInFilePath: tempFilePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR, checksum: split.checksum)
                        singleDownloadHandler(true, split)
                    } catch {
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
                        
                        singleDownloadHandler(false, split)
                    }
                }
            }
        }
        
        self.lazyPackageDownloadStatus = .completed
        let map = NSMutableDictionary()
        map["result"] = "SUCCESS"
        map["reason"] = "lazy"
        map["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - startTime)
        self.tracker.trackInfo("lazy_package_download_result", value: map)
    }
    
    private func retryFailedLazyDownloads() {
        Task.detached(priority: .utility) { [weak self] in
            await self?.retryFailedLazyDownloadsAsync()
        }
    }
    
    private func retryFailedLazyDownloadsAsync() async {
        // A boot-guard fallback package is not installed in the package directory; downloading its
        // lazy splits there would mix them with the blocked package's files and rewrite package.json.
        if self.bootSource != .installed {
            return
        }

        var failedDownloads = [AJPLazyResource]()
        collectionsLock.withLock {
            for resource in self.package.lazy {
                if !resource.isDownloaded {
                    failedDownloads.append(resource)
                }
            }
        }
        
        if !failedDownloads.isEmpty {
            self.tracker.trackInfo("retrying_failed_lazy_downloads", value: NSMutableDictionary(dictionary: ["count": failedDownloads.count]))
            await self.downloadLazyPackageResources(failedDownloads, version: self.package.version, singleDownloadHandler: { [weak self] status, resource in
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
            })
            NotificationCenter.default.post(name: AJPApplicationConstants.LAZY_PACKAGE_NOTIFICATION, object: nil, userInfo: ["lazyDownloadsComplete": true])
        } else {
            self.tracker.trackInfo("no_failed_lazy_downloads", value: NSMutableDictionary())
        }
    }
    
    // Internal (not private) so tests can record a lazy split while a boot guard fallback runs.
    func updateLazyPackageDownloadStatus(_ resource: AJPLazyResource, withStatus isDownloaded: Bool) {
        collectionsLock.withLock {
            // Lazy splits are downloaded into the package directory, so record them on the package
            // installed there (not on a boot guard fallback that this launch runs instead).
            let installedPackage: AJPApplicationPackage = self._displacedPackage ?? self._package
            let updatedLazy = installedPackage.lazy
            var found = false
            for i in 0..<updatedLazy.count {
                if updatedLazy[i].filePath == resource.filePath {
                    updatedLazy[i].isDownloaded = isDownloaded
                    found = true
                    break
                }
            }
            
            if found {
                installedPackage.lazy = updatedLazy
                do {
                    try fileUtil.writeInstance(installedPackage, fileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME, inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
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
        var shouldFire = false
        stateLock.withLock {
            // Check if callbacks should fire and haven't fired yet
            shouldFire = !callbacksFired
                && utils.isDownloadCompleted(_importantPackageDownloadStatus)
                && utils.isDownloadCompleted(_resourceDownloadStatus)
            
            if shouldFire {
                callbacksFired = true
            }
        }
        
        if shouldFire {
            let map = NSMutableDictionary()
            map["time_taken"] = NSNumber(value: (Date().timeIntervalSince1970 * 1000) - self.startTime)
            tracker.trackInfo("update_end", value: map)
            NotificationCenter.default.post(name: AJPApplicationConstants.PACKAGE_RESOURCE_NOTIFICATION, object: nil, userInfo: [:])
        }
    }
        
    private func downloadResourcesWithCurrentResources(_ currentResources: [String: AJPResource], newResources: [String: AJPResource], singleDownloadHandler: @escaping (String, AJPResource) -> Void) async {

        // Step 1: Handle resource file preparation (move current to old)
        utils.handleResourceFilePreparationForDownload()

        // Step 2: Load old resources and compare
        let oldResources = utils.loadOldResourcesForComparison()

        // Step 3: Filter resources using old resources as baseline (instead of current)
        let resourcesToDownload = utils.filterResourcesForDownloadUsingOld(oldResources, newResources: newResources)

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
            return
        }

        // Step 4: Start the download loop with timeout awareness
        await withTaskGroup(of: Void.self) { group in
            let maxConcurrentTasks = 5
            var iterator = resourcesToDownload.enumerated().makeIterator()
            
            // Download each resource
            while let (index, resource) = iterator.next() {
                if self.bootTimeoutOccurred {
                    let infoMap = NSMutableDictionary()
                    infoMap["resource"] = resource.filePath
                    self.tracker.trackInfo("resource_download_stopped_due_to_timeout", value: infoMap)
                    break
                }
                
                if index >= maxConcurrentTasks {
                    await group.next()
                }
                
                group.addTask { [weak self] in
                    guard let self = self else { return }
                    if self.bootTimeoutOccurred { return }
                    
                    do {
                        try await self.utils.downloadFileFromURL(resource.url, andSaveInFilePath: resource.filePath, inFolder: AJPApplicationConstants.JUSPAY_RESOURCE_DIR, checksum: resource.checksum)
                        
                        if !self.bootTimeoutOccurred {
                            // Success - move to main and update available resources
                            self.moveResourceToMainAndUpdate(resource, singleDownloadHandler: singleDownloadHandler)
                        } else {
                            // Timeout occurred - resource downloaded successfully but boot timeout happened
                            // Save this resource to a temp resources file for next session installation
                            self.saveResourceToTempFile(resource)
                            let infoMap = NSMutableDictionary()
                            infoMap["resource"] = resource.filePath
                            self.tracker.trackInfo("resource_downloaded_after_timeout", value: infoMap)
                        }
                    } catch {
                        let errMap = NSMutableDictionary()
                        errMap["resource"] = resource.filePath
                        errMap["error"] = error.localizedDescription
                        self.tracker.trackError("resource_download_failed", value: errMap)
                    }
                }
            }
        }
    }

    private func moveResourceToMainAndUpdate(_ resource: AJPResource, singleDownloadHandler: @escaping (String, AJPResource) -> Void) {
        // Move resource to main directory
        utils.moveResourceToMain(resource)
        
        // Update the available resources
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
        // Update the resources file
        updateResources(availableDict)
        
        // Call the single download handler
        singleDownloadHandler(resource.filePath, resource)
    }

    private func saveResourceToTempFile(_ resource: AJPResource) {
        collectionsLock.withLock {
            // Initialize temp resources if not already done
            if tempResources == nil {
                tempResources = AJPApplicationResources()
                tempResources?.resources = [:]
            }
            
            // Add the new resource to temp resources
            var mutableResources = tempResources?.resources ?? [:]
            mutableResources[resource.filePath] = resource
            tempResources?.resources = mutableResources
            
            // Save to file
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
    }
}

// MARK: - Boot Guard

/// Where the files of the package selected for a launch are read from.
enum AJPBootSource: Equatable {
    /// The installed OTA package in the package directory (the normal case).
    case installed
    /// The last-good snapshot, used because the installed package is blocked.
    case snapshot(URL)
    /// The package shipped in the app bundle, used because the installed package is blocked
    /// and no usable last-good snapshot exists.
    case appBundle
}

/// The JS boot started by this process, recorded on the first bundle-path request.
struct AJPBootSession {
    /// The package whose index was handed to the JS runtime.
    let package: AJPApplicationPackage
    /// Whether this boot counts towards `AJPBootGuard.maxUnacknowledgedBoots`.
    let tracked: Bool
    /// Where the files of `package` are read from for the rest of the process.
    let source: AJPBootSource
    /// Directory holding the booted package's files; copied into a snapshot on acknowledgement.
    let sourceDirectory: URL?

    /// Whether `package` is the last-good snapshot substituted for a blocked package.
    var fromSnapshot: Bool {
        if case .snapshot = source {
            return true
        }
        return false
    }
}

/**
 * Opt-in boot guard: blocks an OTA package whose JS boots are never acknowledged and falls back to
 * the last acknowledged (last-good) package, else to the bundled package.
 *
 * One guard exists per workspace per process. It owns the persisted state (pending, attempts,
 * blocked, lastGood, snapshot, binary identity) and the last-good snapshot directories, all under
 * `directory`. Every state read and write happens under `lock`; snapshot copies run outside it on
 * `snapshotQueue`. Failures to persist or snapshot are reported through `onEvent` and never crash
 * the app.
 */
final class AJPBootGuard: @unchecked Sendable {

    typealias EventHandler = (_ key: String, _ value: [String: Any], _ isError: Bool) -> Void

    /// Unacknowledged boots of one package version before that version is blocked.
    /// Web, Android and iOS must use the same value.
    static let maxUnacknowledgedBoots = 2
    /// Name prefix of last-good snapshot directories inside `directory`.
    static let snapshotPrefix = "airborne-good-"
    static let stateFileName = "state.json"

    /// Keys of the persisted state dictionary.
    private enum Key {
        static let binaryIdentity = "binary"
        static let pending = "pending"
        static let attempts = "attempts"
        static let blocked = "blocked"
        static let lastGood = "lastGood"
        /// Snapshot directory name, relative to `directory` (container paths change across restores).
        static let snapshot = "snapshot"
    }

    let enabled: Bool
    let directory: URL
    var stateURL: URL { directory.appendingPathComponent(AJPBootGuard.stateFileName) }

    private let lock = NSRecursiveLock()
    private let fileManager = FileManager.default
    private var state: [String: Any] = [:]
    private var session: AJPBootSession?
    private var onEvent: EventHandler?

    /// Snapshots copy package files, so they run here rather than on the acknowledging thread
    /// (often the main thread or the React Native bridge queue). Serial: one snapshot at a time.
    private let snapshotQueue = DispatchQueue(label: "in.juspay.airborne.bootguard.snapshot", qos: .utility)
    private var snapshotInProgress = false
    /// Package installs started in this process (see `packageInstallStarted()`).
    private var installCount = 0
    /// `installCount` when this process's boot was recorded.
    private var installCountAtBoot = 0

    // MARK: Process-wide registry

    private static let registryLock = NSLock()
    private static var registry: [String: AJPBootGuard] = [:]

    /**
     * Returns this process's guard for `workspace`, creating it on first use.
     *
     * The opt-in flag and the launch checks (binary identity, rollback, orphan sweep) are evaluated
     * once per process, by the first manager created for the workspace. Later managers share that
     * guard and its boot session; only their event handler replaces the previous one.
     */
    static func shared(workspace: String, enabled: Bool, binaryIdentity: String, onEvent: @escaping EventHandler) -> AJPBootGuard {
        registryLock.lock()
        defer { registryLock.unlock() }

        if let existing = registry[workspace] {
            existing.setEventHandler(onEvent)
            return existing
        }
        let created = AJPBootGuard(
            directory: directory(forWorkspace: workspace),
            enabled: enabled,
            binaryIdentity: binaryIdentity,
            onEvent: onEvent
        )
        registry[workspace] = created
        return created
    }

    /// Per-workspace guard directory: `Application Support/airborne-boot/<base64 workspace>/`.
    static func directory(forWorkspace workspace: String) -> URL {
        let key = Data(workspace.utf8).base64EncodedString().replacingOccurrences(of: "/", with: "_")
        let supportDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return supportDirectory
            .appendingPathComponent("airborne-boot", isDirectory: true)
            .appendingPathComponent(key, isDirectory: true)
    }

    /// Forgets the process-wide guard of `workspace`, so the next manager behaves like a new launch.
    /// For tests only.
    static func forgetForTesting(workspace: String) {
        registryLock.lock()
        defer { registryLock.unlock() }
        registry.removeValue(forKey: workspace)
    }

    // MARK: Launch

    /// Creates a guard and runs the launch checks. Use `shared(...)` outside tests.
    init(directory: URL, enabled: Bool, binaryIdentity: String, onEvent: EventHandler? = nil) {
        self.directory = directory
        self.enabled = enabled
        self.onEvent = onEvent

        if enabled {
            startLaunch(binaryIdentity: binaryIdentity)
        } else {
            discardEverything(reason: "guard_disabled")
        }
    }

    private func setEventHandler(_ handler: @escaping EventHandler) {
        lock.lock()
        defer { lock.unlock() }
        onEvent = handler
    }

    private func startLaunch(binaryIdentity: String) {
        lock.lock()
        defer { lock.unlock() }

        state = loadState()
        var changed = false

        // A last-good package from another app binary must never be used.
        if !state.isEmpty && state[Key.binaryIdentity] as? String != binaryIdentity {
            state = [:]
            deleteSnapshots(keeping: nil)
            emit("boot_guard_reset", ["reason": "binary_changed"])
            changed = true
        }
        if state[Key.binaryIdentity] as? String != binaryIdentity {
            state[Key.binaryIdentity] = binaryIdentity
            changed = true
        }

        // Forget a snapshot reference whose directory is gone (for example after a device restore).
        if state[Key.snapshot] != nil && currentSnapshotDirectory() == nil {
            state.removeValue(forKey: Key.snapshot)
            changed = true
        }

        if rollBackIfNeeded() {
            changed = true
        }

        deleteSnapshots(keeping: state[Key.snapshot] as? String)

        if changed {
            persist()
        }
    }

    /// Blocks a package that reached `maxUnacknowledgedBoots`. Returns whether the state changed.
    private func rollBackIfNeeded() -> Bool {
        guard let pending = state[Key.pending] as? String,
              attempts >= AJPBootGuard.maxUnacknowledgedBoots else {
            return false
        }

        if pending == lastGoodVersion {
            // The last-good fallback failed too. Drop it so the next launch uses the bundled package
            // instead of alternating between two broken packages; keep the original block.
            dropLastGood()
            if state[Key.blocked] == nil {
                state[Key.blocked] = pending
            }
        } else {
            state[Key.blocked] = pending
        }

        state.removeValue(forKey: Key.pending)
        state[Key.attempts] = 0
        emit("rollback", ["packageVersion": pending])
        return true
    }

    private func discardEverything(reason: String) {
        guard fileManager.fileExists(atPath: directory.path) else { return }
        do {
            try fileManager.removeItem(at: directory)
            emit("boot_guard_reset", ["reason": reason])
        } catch {
            emit("boot_guard_reset_failed", ["reason": reason, "error": error.localizedDescription], isError: true)
        }
    }

    // MARK: Selection

    func isBlocked(_ version: String) -> Bool {
        guard enabled else { return false }
        lock.lock()
        defer { lock.unlock() }
        return blockedVersion == version
    }

    /// Reports that the blocked `version` was found (`source`: installed, staged, release_config, download).
    func reportBlockedPackage(_ version: String, source: String) {
        emit("blocked-package", ["packageVersion": version, "source": source])
    }

    /// Returns true (and reports it) when `version` is blocked and must not be installed.
    func refusePackage(_ version: String, source: String) -> Bool {
        guard isBlocked(version) else { return false }
        reportBlockedPackage(version, source: source)
        return true
    }

    /// The last-good package and its snapshot directory, when usable in place of a blocked package:
    /// it must differ from the blocked version and its snapshot must contain its index file.
    func lastGoodFallback() -> (package: AJPApplicationPackage, directory: URL)? {
        guard enabled else { return nil }
        lock.lock()
        defer { lock.unlock() }

        guard let dictionary = state[Key.lastGood] as? NSDictionary,
              let package = try? AJPApplicationPackage(dictionary: dictionary),
              package.version != blockedVersion,
              !package.index.filePath.isEmpty,
              let snapshotDirectory = currentSnapshotDirectory(),
              let indexURL = AJPBootGuard.containedURL(package.index.filePath, in: snapshotDirectory),
              fileManager.fileExists(atPath: indexURL.path) else {
            return nil
        }
        return (package, snapshotDirectory)
    }

    /// Clears the block once a server-delivered package with another version has been installed.
    /// Only call this after the package is committed to disk, never for SDK-substituted packages.
    func packageInstalled(_ version: String) {
        guard enabled else { return }
        lock.lock()
        defer { lock.unlock() }

        guard let blocked = blockedVersion, blocked != version else { return }
        state.removeValue(forKey: Key.blocked)
        persist()
        emit("boot_guard_unblocked", ["blockedVersion": blocked, "packageVersion": version])
    }

    // MARK: Boot and acknowledgement

    var hasBootSession: Bool {
        bootSession != nil
    }

    /// The JS boot of this process (its package and where its files are read from), shared by
    /// every manager of the workspace; nil until a manager hands a bundle to the JS runtime.
    var bootSession: AJPBootSession? {
        lock.lock()
        defer { lock.unlock() }
        return session
    }

    /// Records the boot of this process. Only the first call per process has any effect.
    func beginBoot(_ newSession: AJPBootSession) {
        guard enabled else { return }
        lock.lock()
        defer { lock.unlock() }

        guard session == nil else { return }
        session = newSession
        installCountAtBoot = installCount

        let version = newSession.package.version
        guard newSession.tracked, !version.isEmpty else { return }

        let previousAttempts = state[Key.pending] as? String == version ? attempts : 0
        state[Key.pending] = version
        state[Key.attempts] = previousAttempts + 1
        persist()
    }

    /**
     * Records that a package install started in this process: files in the package directory may
     * no longer belong to the package booted by this process, so it must not be snapshotted.
     * Call before moving a new package's files into the package directory or recording it as installed.
     */
    func packageInstallStarted() {
        guard enabled else { return }
        lock.lock()
        defer { lock.unlock() }
        installCount += 1
    }

    /**
     * Acknowledges this process's boot. Clears pending/attempts on the calling thread, then
     * schedules `refreshSnapshot` on `snapshotQueue` (unless the boot ran from the last-good
     * snapshot or a snapshot is already running). A failed snapshot keeps the previous last-good.
     */
    func markBootSuccess() {
        guard enabled else { return }

        lock.lock()
        guard let session = session,
              session.tracked,
              state[Key.pending] as? String == session.package.version else {
            lock.unlock()
            return
        }
        state.removeValue(forKey: Key.pending)
        state[Key.attempts] = 0
        persist()

        let startSnapshot = !session.fromSnapshot && session.sourceDirectory != nil && !snapshotInProgress
        if startSnapshot {
            snapshotInProgress = true
        }
        lock.unlock()

        guard startSnapshot else { return }
        snapshotQueue.async {
            self.refreshSnapshot(of: session)
            self.lock.lock()
            self.snapshotInProgress = false
            self.lock.unlock()
        }
    }

    /// Blocks until a snapshot scheduled by `markBootSuccess()` has finished. For tests only.
    func waitForSnapshotForTesting() {
        snapshotQueue.sync {}
    }

    /// Takes a snapshot of the booted package unless an up-to-date one exists: the last-good
    /// package is this version and its snapshot holds every file now present in the package
    /// directory (lazy splits may arrive after the first snapshot). Runs on `snapshotQueue`.
    private func refreshSnapshot(of session: AJPBootSession) {
        guard let sourceDirectory = session.sourceDirectory else { return }
        let package = session.package

        if !bootedFilesAreInstalled() {
            reportSnapshotSkipped(package.version)
            return
        }

        lock.lock()
        let existingSnapshot = lastGoodVersion == package.version ? currentSnapshotDirectory() : nil
        lock.unlock()

        if let existingSnapshot = existingSnapshot,
           !snapshotLacksFiles(of: package, from: sourceDirectory, snapshot: existingSnapshot) {
            return
        }
        saveSnapshot(of: package, from: sourceDirectory)
    }

    /// Whether the package directory still holds the package booted by this process (no install
    /// started since the boot). Otherwise its files may belong to a newer package.
    private func bootedFilesAreInstalled() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return installCount == installCountAtBoot
    }

    private func reportSnapshotSkipped(_ version: String) {
        emit("boot_guard_snapshot_skipped", [
            "packageVersion": version,
            "reason": "another package was installed after this boot"
        ])
    }

    /// Whether a file of `package` exists in `source` but not in `snapshot`.
    private func snapshotLacksFiles(of package: AJPApplicationPackage, from source: URL, snapshot: URL) -> Bool {
        for split in package.allSplits() where !split.filePath.isEmpty {
            guard let sourceURL = AJPBootGuard.containedURL(split.filePath, in: source),
                  let snapshotURL = AJPBootGuard.containedURL(split.filePath, in: snapshot) else {
                continue
            }
            if fileManager.fileExists(atPath: sourceURL.path) && !fileManager.fileExists(atPath: snapshotURL.path) {
                return true
            }
        }
        return false
    }

    private func saveSnapshot(of package: AJPApplicationPackage, from sourceDirectory: URL) {
        let name = AJPBootGuard.snapshotPrefix + UUID().uuidString
        let newSnapshot = directory.appendingPathComponent(name, isDirectory: true)

        do {
            try copyPackageFiles(of: package, from: sourceDirectory, to: newSnapshot)
        } catch {
            try? fileManager.removeItem(at: newSnapshot)
            emit("boot_guard_snapshot_failed", [
                "packageVersion": package.version,
                "error": error.localizedDescription
            ], isError: true)
            return
        }

        lock.lock()
        defer { lock.unlock() }

        // A package installed while copying may have replaced some of the copied files.
        if !bootedFilesAreInstalled() {
            try? fileManager.removeItem(at: newSnapshot)
            reportSnapshotSkipped(package.version)
            return
        }

        let previousName = state[Key.snapshot] as? String
        let previousLastGood = state[Key.lastGood]
        state[Key.lastGood] = package.toDictionary()
        state[Key.snapshot] = name

        if persist() {
            if let previousName = previousName, let previous = snapshotDirectory(named: previousName) {
                try? fileManager.removeItem(at: previous)
            }
        } else {
            // The state on disk still names the previous snapshot; keep it and drop the new one.
            state[Key.snapshot] = previousName
            state[Key.lastGood] = previousLastGood
            try? fileManager.removeItem(at: newSnapshot)
        }
    }

    /// Copies the package's files (index required, other splits when present) into `target`.
    private func copyPackageFiles(of package: AJPApplicationPackage, from source: URL, to target: URL) throws {
        if package.index.filePath.isEmpty {
            throw AJPBootGuard.makeError("Package has no index file")
        }
        try fileManager.createDirectory(at: target, withIntermediateDirectories: true)
        var targetURL = target
        var resourceValues = URLResourceValues()
        resourceValues.isExcludedFromBackup = true
        try? targetURL.setResourceValues(resourceValues)

        var copiedPaths = Set<String>()
        for split in package.allSplits() {
            let relativePath = split.filePath
            if relativePath.isEmpty {
                continue
            }
            guard let sourceURL = AJPBootGuard.containedURL(relativePath, in: source),
                  let destinationURL = AJPBootGuard.containedURL(relativePath, in: target) else {
                throw AJPBootGuard.makeError("Package file path escapes its directory: \(relativePath)")
            }
            // The same file can be listed more than once (for example the index also in important).
            if !copiedPaths.insert(destinationURL.path).inserted {
                continue
            }
            if !fileManager.fileExists(atPath: sourceURL.path) {
                if relativePath == package.index.filePath {
                    throw AJPBootGuard.makeError("Index file missing: \(relativePath)")
                }
                continue
            }
            try fileManager.createDirectory(at: destinationURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try fileManager.copyItem(at: sourceURL, to: destinationURL)
        }
    }

    // MARK: Paths

    /**
     * Resolves `relativePath` inside `root`, with the same rule as `readPackageFile`
     * (`AJPApplicationManager.isPackageRelativePath`): absolute paths and paths with any ".."
     * component are rejected, never resolved. "." and empty components are dropped by
     * standardizing, and the result must still be strictly inside `root` (so "" and "." are nil).
     */
    static func containedURL(_ relativePath: String, in root: URL) -> URL? {
        guard AJPApplicationManager.isPackageRelativePath(relativePath) else {
            return nil
        }
        let base = root.standardizedFileURL
        let url = base.appendingPathComponent(relativePath).standardizedFileURL
        let basePath = base.path.hasSuffix("/") ? base.path : base.path + "/"
        guard url.path.hasPrefix(basePath), url.path.count > basePath.count else {
            return nil
        }
        return url
    }

    private func snapshotDirectory(named name: String) -> URL? {
        guard name.hasPrefix(AJPBootGuard.snapshotPrefix), !name.contains("/") else { return nil }
        return directory.appendingPathComponent(name, isDirectory: true)
    }

    /// The referenced snapshot directory, if the reference is valid and the directory exists.
    private func currentSnapshotDirectory() -> URL? {
        guard let name = state[Key.snapshot] as? String,
              let url = snapshotDirectory(named: name) else {
            return nil
        }
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            return nil
        }
        return url
    }

    /// Deletes every snapshot directory except `kept` (orphans from failed or superseded snapshots).
    private func deleteSnapshots(keeping kept: String?) {
        guard let names = try? fileManager.contentsOfDirectory(atPath: directory.path) else { return }
        for name in names where name.hasPrefix(AJPBootGuard.snapshotPrefix) && name != kept {
            try? fileManager.removeItem(at: directory.appendingPathComponent(name))
        }
    }

    private func dropLastGood() {
        if let name = state[Key.snapshot] as? String, let url = snapshotDirectory(named: name) {
            try? fileManager.removeItem(at: url)
        }
        state.removeValue(forKey: Key.snapshot)
        state.removeValue(forKey: Key.lastGood)
    }

    // MARK: State

    private var attempts: Int {
        state[Key.attempts] as? Int ?? 0
    }

    private var blockedVersion: String? {
        state[Key.blocked] as? String
    }

    private var lastGoodVersion: String? {
        (state[Key.lastGood] as? NSDictionary)?["version"] as? String
    }

    private func loadState() -> [String: Any] {
        guard let data = try? Data(contentsOf: stateURL),
              let object = try? JSONSerialization.jsonObject(with: data),
              let loaded = object as? [String: Any] else {
            return [:]
        }
        return loaded
    }

    /// Writes the state. A failure is reported and the guard continues best effort for this session.
    @discardableResult
    private func persist() -> Bool {
        guard JSONSerialization.isValidJSONObject(state) else {
            emit("boot_guard_persist_failed", ["error": "state is not valid JSON"], isError: true)
            return false
        }
        do {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONSerialization.data(withJSONObject: state)
            try data.write(to: stateURL, options: .atomic)
            return true
        } catch {
            emit("boot_guard_persist_failed", ["error": error.localizedDescription], isError: true)
            return false
        }
    }

    private func emit(_ key: String, _ value: [String: Any], isError: Bool = false) {
        lock.lock()
        let handler = onEvent
        lock.unlock()
        handler?(key, value, isError)
    }

    private static func makeError(_ message: String) -> NSError {
        NSError(domain: "in.juspay.Airborne.BootGuard", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}

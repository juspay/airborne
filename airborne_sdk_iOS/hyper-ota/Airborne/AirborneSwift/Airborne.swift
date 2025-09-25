//
//  Airborne.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation
#if SWIFT_PACKAGE
import AirborneObjC
#endif

// MARK: - AirborneDelegate Protocol

/**
 * Protocol defining the interface for Airborne delegates to customize behavior and receive callbacks.
 *
 * All methods are optional, providing sensible defaults when not implemented.
 */
@objc public protocol AirborneDelegate {
    
    /**
     * Returns the namespace identifier for this application instance.
     *
     * The namespace is used to isolate application manager instances
     * across different workspaces
     *
     * @return A string identifier for the application namespace.
     *         If not implemented, defaults to "juspay".
     */
    @objc func namespace() -> String
    
    /**
     * Returns the custom bundle for loading local assets and fallback files.
     *
     * This path is used when OTA-downloaded files are not available
     *
     * @return The file system path to the bundle containing local assets.
     *         If not implemented, defaults to the main bundle path.
     *
     * @note The path should point to a directory containing the default
     *       release config and other assets(including index file) bundled with the app.
     */
    @objc optional func bundle() -> Bundle
    
    /**
     * Returns custom dimensions/metadata to include with release configuration requests.
     *
     * These dimensions are sent as HTTP headers when fetching the release configuration
     * and can be used for:
     * - A/B testing and feature flags
     * - Device-specific configurations
     * - User segmentation
     * - Analytics and debugging context
     *
     * @return A dictionary of header field names and values to include in network requests.
     *         If not implemented, defaults to an empty dictionary.
     */
    @objc optional func dimensions() -> [String: String]
    
    /**
     * Called when the OTA boot process has completed successfully.
     *
     * This callback indicates that the application is ready to load the packages & resources
     *
     * @param indexBundlePath The file system path to the index bundle file that should
     *                     be used as the entry point for the downloaded content.
     *
     * @note This method is called on a background queue. Dispatch UI updates
     *       to the main queue if needed.
     * @note Boot completion occurs even if some downloads failed or timed out.
     *       Check the release configuration for actual status.
     */
    @objc func startApp(indexBundleURL: URL) -> Void
    
    /**
     * Called when significant events occur during the OTA update process.
     *
     * This callback provides detailed information about:
     * - Download progress and completion
     * - Error conditions and failures
     * - Performance metrics and timing
     * - State transitions in the update process
     *
     * @param level The severity level of the event ("info", "error", "warning")
     * @param label A category label for the event (e.g., "ota_update")
     * @param key A specific identifier for the event type
     * @param value Additional structured data about the event
     * @param category The broad category of the event (e.g., "lifecycle")
     * @param subcategory The specific subcategory (e.g., "hyperota")
     *
     * @note Use this for logging, analytics, debugging, and monitoring OTA performance.
     */
    @objc optional func onEvent(level: String, label: String, key: String, value: [String: Any], category: String, subcategory: String) -> Void
    
    /**
     * Called when an individual lazy package download completes (either successfully or with failure).
     *
     * @param downloadSuccess Whether the lazy package download was successful
     * @param url The URL of the lazy package that was downloaded
     * @param filePath The file path where the package was stored
     */
    @objc optional func onLazyPackageDownloadComplete(downloadSuccess: Bool, url: String, filePath: String) -> Void
    
    /**
     * Called when all lazy package downloads have completed.
     *
     * @note To get individual package results, use `onLazyPackageDownloadComplete` callback.
     */
    @objc optional func onAllLazyPackageDownloadsComplete() -> Void
}

// MARK: - AirborneServices Class

/**
 * The main entry point for Airborne OTA functionality.
 *
 * AirborneServices manages the complete OTA update lifecycle including:
 * - Fetching release configurations from remote servers
 * - Downloading and installing packages and resources
 * - Providing access to updated bundles and configurations
 * - Handling timeouts, errors, and fallback scenarios
 *
 * Usage:
 * ```swift
 * let airborne = AirborneServices(
 *     releaseConfigURL: "https://your-server.com/release-config.json",
 *     delegate: self
 * )
 * ```
 *
 * The service automatically begins the update process upon initialization and
 * calls delegate methods to notify about progress and completion.
 */
@objc public class AirborneServices: NSObject {
    
    // MARK: - Private Properties
    
    private let releaseConfigURL: String
    private lazy var namespace: String = {
        // TODO: Default namespace needs to be confirmed
        delegate?.namespace() ?? "default"
    }()
    private lazy var dimensions: [String: String] = {
        delegate?.dimensions?() ?? [:]
    }()
    private lazy var bundlePath: Bundle = {
        delegate?.bundle?() ?? Bundle.main
    }()
    
    private weak var delegate: AirborneDelegate?
    private var applicationManager: AJPApplicationManager?
    private var lazyPackageObserver: NSObjectProtocol?
    
    // MARK: - Initialization
    
    /**
     * Initializes AirborneServices with a release configuration URL and optional delegate.
     *
     * @param releaseConfigURL The URL endpoint for fetching release configuration.
     *                        This should return release config JSON.
     * @param delegate An optional delegate implementing AirborneDelegate protocol
     *                to receive callbacks and provide custom configuration.
     *
     * @note The update process starts immediately upon initialization.
     *       Monitor delegate callbacks to track progress and completion.
     * @note Network requests begin on background queues to avoid blocking initialization.
     */
    @objc public init(releaseConfigURL: String, delegate: AirborneDelegate? = nil) {
        self.releaseConfigURL = releaseConfigURL
        self.delegate = delegate
        super.init()
        self.setupLazyPackageNotifications()
        self.startApplicationManager()
    }
    
    public func getBaseBundle() -> Bundle {
        return bundlePath
    }
    
    deinit {
        if let observer = lazyPackageObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }
    
    // MARK: - Private Methods
    
    private func startApplicationManager() {
        self.applicationManager = AJPApplicationManager.getSharedInstance(withWorkspace: self.namespace, delegate: self, logger: self)
        self.applicationManager?.waitForPackagesAndResources { [weak self] _ in

            if let indexBundleURL = self?.getIndexBundlePath() {
                self?.delegate?.startApp(indexBundleURL: indexBundleURL)
            } else {
                print("❌ Could not find a valid JS bundle URL")
            }
        }
    }
    
    private func setupLazyPackageNotifications() {
        // Only set up if at least one delegate method is implemented
        guard delegate?.onLazyPackageDownloadComplete != nil ||
              delegate?.onAllLazyPackageDownloadsComplete != nil else {
            return
        }
        lazyPackageObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("AJPLazyPackageNotification"),
            object: nil,
            queue: OperationQueue()
        ) { [weak self] notification in
            self?.handleLazyPackageNotification(notification)
        }
    }
    
    private func handleLazyPackageNotification(_ notification: Notification) {
        guard let userInfo = notification.userInfo else { return }
        
        let lazyDownloadsComplete = userInfo["lazyDownloadsComplete"] as? Bool ?? false
        
        if lazyDownloadsComplete {
            // All lazy downloads are complete
            delegate?.onAllLazyPackageDownloadsComplete?()
        } else {
            
            if delegate?.onLazyPackageDownloadComplete == nil {
                return
            }
            
            // Individual lazy package download completed
            let downloadStatus = userInfo["downloadStatus"] as? Bool ?? false
            let packageURL = userInfo["url"] as? URL
            let filePath = userInfo["filePath"] as? String
            
            let urlString = packageURL?.absoluteString ?? ""
            let filePathString = filePath ?? ""
            
            delegate?.onLazyPackageDownloadComplete?(
                downloadSuccess: downloadStatus,
                url: urlString,
                filePath: filePathString
            )
        }
    }
}

// MARK: - Public API Methods

extension AirborneServices {
    
    /**
     * Returns the file system path to the current index bundle.
     *
     * @return The absolute file system path to the index JavaScript bundle.
     *         This is either the OTA-updated version or the fallback bundled version.
     *
     * @note The path is guaranteed to be valid, falling back to bundled assets if needed.
     * @note Call this method after `startApp` for the most up-to-date bundle.
     */
    @objc public func getIndexBundlePath() -> URL {
        guard
            let indexFilePath = self.applicationManager?.getCurrentApplicationManifest().package.index.filePath,
            !indexFilePath.isEmpty
        else {
            return bundlePath.url(forResource: "main", withExtension: "jsbundle") ?? bundlePath.bundleURL.appendingPathComponent("main.jsbundle") // get this from release config
        }
            
        guard
            let filePath = self.applicationManager?.getPathForPackageFile(indexFilePath),
            FileManager.default.fileExists(atPath: filePath)
        else {
            let filePath = filePathInBundleForFileName(indexFilePath)
            if let filePath = filePath {
                return URL(fileURLWithPath: filePath)
            } else {
                return bundlePath.bundleURL.appendingPathComponent(indexFilePath)
            }
        }
        
        return URL(fileURLWithPath: filePath)
    }
    
    private func filePathInBundleForFileName(_ fileName: String) -> String? {
        let fileNameComponents = fileName.components(separatedBy: ".")
        
        guard fileNameComponents.count > 1 else {
            return nil
        }

        let fileNameString = fileNameComponents.dropLast().joined(separator: ".")
        let fileExtension = fileNameComponents.last!

        if let filePathInBundle = self.bundlePath.path(forResource: fileNameString, ofType: fileExtension) {
            return filePathInBundle
        }

        return nil
    }
    
    /**
     * Returns the current release configuration as a JSON string.
     *
     * @return A JSON string representation of the current application manifest.
     *         Returns an empty string if manifest cannot be serialized.
     */
    @objc public func getReleaseConfig() -> String {
        let manifest = self.applicationManager?.getCurrentApplicationManifest().toDictionary()
        guard let manifestDict = manifest as? [String: Any] else {
            return ""
        }
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: manifestDict, options: .prettyPrinted)
            return String(data: jsonData, encoding: .utf8) ?? ""
        } catch {
            debugPrint("Error converting manifest to JSON: \(error)")
            return ""
        }
    }
    
    /**
     * Reads and returns the content of a package file.
     *
     * @param path The relative path to the file within the package structure.
     *            This should match the filePath specified in the package manifest.
     *
     * @return The content of the file as a UTF-8 string, or nil if the file
     *         cannot be read or does not exist.
     */
    @objc public func getFileContent(atPath path: String) -> String? {
        return applicationManager?.readPackageFile(path)
    }
}

// MARK: - AJPApplicationManagerDelegate Conformance

extension AirborneServices: AJPApplicationManagerDelegate {
    
    /**
     * Provides the release configuration URL to the application manager.
     */
    public func getReleaseConfigURL() -> String {
        self.releaseConfigURL
    }
    
    /**
     * Provides HTTP headers for release configuration requests.
     */
    public func getReleaseConfigHeaders() -> [String : String] {
        self.dimensions
    }
}

// MARK: - AJPLoggerDelegate Conformance

extension AirborneServices: AJPLoggerDelegate {
    
    /**
     * Handles logging events from the application manager and forwards them to the delegate.
     */
    public func trackEvent(withLevel level: String!, label: String!, key: String!, value: Any!, category: String!, subcategory: String!) {
        let valueDict = value as? [String: Any] ?? [:]
        self.delegate?.onEvent?(level: level, label: label, key: key, value: valueDict, category: category, subcategory: subcategory)
    }
}

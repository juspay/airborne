//
//  Airborne.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation

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
    @objc optional func namespace() -> String
    
    /**
     * Returns the custom bundle path for loading local assets and fallback files.
     *
     * This path is used when OTA-downloaded files are not available
     *
     * @return The file system path to the bundle containing local assets.
     *         If not implemented, defaults to the main bundle path.
     *
     * @note The path should point to a directory containing the default
     *       release config, packages, resources and other assets bundled with the app.
     */
    @objc optional func bundlePath() -> String
    
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
    @objc optional func onBootComplete(indexBundlePath: String) -> Void
    
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
        delegate?.namespace?() ?? "juspay"
    }()
    private lazy var dimensions: [String: String] = {
        delegate?.dimensions?() ?? [:]
    }()
    private lazy var bundlePath: String = {
        delegate?.bundlePath?() ?? Bundle.main.bundlePath
    }()
    
    private weak var delegate: AirborneDelegate?
    private var applicationManager: HPJPApplicationManager?
    
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
        self.startApplicationManager()
    }
    
    // MARK: - Private Methods
    
    private func startApplicationManager() {
        self.applicationManager = HPJPApplicationManager.getSharedInstance(withWorkspace: self.namespace, delegate: self, logger: self)
        self.applicationManager?.waitForPackagesAndResources { [weak self] _ in
            if let indexBundlePath = self?.getIndexBundlePath() {
                self?.delegate?.onBootComplete?(indexBundlePath: indexBundlePath)
            }
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
     * @note Call this method after `onBootComplete` for the most up-to-date bundle.
     */
    @objc public func getIndexBundlePath() -> String {
        guard
            let indexFilePath = self.applicationManager?.getCurrentApplicationManifest().package.index.filePath,
            !indexFilePath.isEmpty
        else {
            return self.bundlePath
        }
            
        guard
            let filePath = self.applicationManager?.getPathForPackageFile(indexFilePath),
            FileManager.default.fileExists(atPath: filePath)
        else {
            return self.bundlePath.appendPathComponent(indexFilePath)
        }
        
        return filePath
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

// MARK: - HPJPApplicationManagerDelegate Conformance

extension AirborneServices: HPJPApplicationManagerDelegate {
    
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

// MARK: - HPJPLoggerDelegate Conformance

extension AirborneServices: HPJPLoggerDelegate {
    
    /**
     * Required function for logger delegate conformance.
     * Not currently used by ApplicationManager.
     */
    public func trackEvent(withLevel level: String!, label: String!, value: Any!, category: String!, subcategory: String!) {
        // Implementation not required for current ApplicationManager usage
    }
    
    /**
     * Handles logging events from the application manager and forwards them to the delegate.
     */
    public func trackEvent(withLevel level: String!, label: String!, key: String!, value: Any!, category: String!, subcategory: String!) {
        let valueDict = value as? [String: Any] ?? [:]
        self.delegate?.onEvent?(level: level, label: label, key: key, value: valueDict, category: category, subcategory: subcategory)
    }
}

// MARK: - String Extension

extension String {
    /**
     * Convenience method for appending path components to string paths.
     */
    func appendPathComponent(_ pathComponent: String) -> String {
        return (self as NSString).appendingPathComponent(pathComponent)
    }
}

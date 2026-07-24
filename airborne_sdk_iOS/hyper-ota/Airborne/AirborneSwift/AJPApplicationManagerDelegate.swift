import Foundation
#if SWIFT_PACKAGE
import AirborneSwiftCore
#endif

/**
 * Protocol defining the interface for application manager delegates responsible for
 * fetching release configuration and providing application-specific settings.
 */
@objc public protocol AJPApplicationManagerDelegate: NSObjectProtocol {
    
    /**
     * Returns the URL to use for fetching release configuration.
     *
     * This method allows the delegate to specify a custom URL for downloading
     * the release configuration instead of using the default URL pattern.
     * The URL should point to a valid release configuration endpoint that
     * returns JSON data compatible with AJPApplicationManifest.
     *
     * @return A non-null string containing the release configuration URL.
     *         The URL may contain format specifiers that will be replaced
     *         with appropriate values (client ID, environment path, etc.).
     *
     * @note This method will not be called if fetchReleaseConfigForClientId:completionHandler:
     *       is implemented by the delegate. When the delegate provides a custom fetch
     *       implementation, it takes full responsibility for the release configuration
     *       retrieval process.
     */
    @objc func getReleaseConfigURL() -> String
    
    /**
     * Returns HTTP headers to include when fetching release configuration.
     *
     * This method allows the delegate to specify custom HTTP headers that
     * should be sent along with the release configuration request. These
     * headers can be used for authentication, authorization, or providing
     * additional context to the server.
     *
     * @return A non-null dictionary containing HTTP header field names as keys
     *         and their corresponding values as strings. Returns an empty
     *         dictionary if no custom headers are needed.
     *
     * @note This method will not be called if fetchReleaseConfigForClientId:completionHandler:
     *       is implemented by the delegate. When the delegate provides a custom fetch
     *       implementation, it takes full responsibility for the release configuration
     *       retrieval process, including any required headers.
     */
    @objc optional func getReleaseConfigHeaders() -> [String: String]

    /**
     * Returns the public keys used to verify the release configuration's signature.
     *
     * The server signs each release configuration response and names the signing key in the
     * `X-Airborne-Signature` header. The returned dictionary maps each trusted key ID to its
     * ECDSA P-256 public key in SPKI PEM form.
     *
     * @return A non-null dictionary of key IDs to PEM-encoded public keys. Returns an empty
     *         dictionary to disable signature verification.
     *
     * @note Verification runs on the raw response bytes before the configuration is parsed.
     *       A response carrying a signature that cannot be verified is discarded; a response
     *       carrying no signature at all is accepted.
     * @note This method will not be called if the delegate provides a custom release config
     *       fetch implementation, which takes full responsibility for verification.
     */
    @objc optional func getReleaseConfigPublicKeys() -> [String: String]

    /**
     * Returns the bundle to use for loading local assets and configuration files.
     *
     * This method allows the delegate to specify a custom bundle for loading local resources
     * such as default configuration files, package definitions, and other assets that may
     * be bundled with the application.
     *
     * @return A bundle object to use for local asset loading. Must not be nil.
     *
     * @discussion If not implemented, the application manager will use [NSBundle mainBundle]
     *             as the default.
     *
     * @note This method may be called multiple times and should return a consistent result
     *       throughout the lifetime of the delegate object.
     */
    @objc optional func getBaseBundle() -> Bundle
    
    /**
     * Determines whether the application should use only local assets without network requests.
     *
     * When this method returns YES, the application manager will:
     * - Skip all network-based downloads
     * - Use only locally bundled assets and configurations
     *
     * @return YES if only local assets should be used, NO if network operations are allowed
     *
     * @note When local assets mode is enabled, the fetchReleaseConfigForClientId:completionHandler:
     *       method won't be called.
     */
    @objc optional func shouldUseLocalAssets() -> Bool
    
    /**
     * Determines whether the application should perform force updates when packages are downloaded.
     *
     * @return YES if packages should be moved to main when downloads complete before timeout,
     *         NO otherwise. Default is YES.
     */
    @objc optional func shouldDoForceUpdate() -> Bool
    
    /**
     * Returns the file utility instance for local file operations.
     *
     * This method allows the delegate to provide a custom file utility instance
     * for handling local file system operations such as reading, writing, and
     * managing files within the application's workspace.
     *
     * @return A non-null AJPFileUtil instance configured for the delegate's
     *         file management requirements.
     *
     * @note The returned instance should be properly configured with the
     *       appropriate workspace and bundle settings for the application.
     *       If not implemented, the SDK will use its default
     *       AJPFileUtil implementation.
     */
    @objc optional func getFileUtil() -> AJPFileUtil
    
    /**
     * Returns the remote file utility instance for network-based file operations.
     *
     * This method allows the delegate to provide a custom remote file utility
     * instance for handling file downloads, uploads, and other network-based
     * file operations with checksum validation and secure transfer capabilities.
     *
     * @return A non-null AJPRemoteFileUtil instance configured for the delegate's
     *         remote file management requirements.
     *
     * @note The returned instance should be properly configured with the
     *       appropriate network client and security settings for safe file transfers.
     *       If not implemented, the SDK will use its default
     *       AJPRemoteFileUtil implementation.
     */
    @objc optional func getRemoteFileUtil() -> AJPRemoteFileUtil

    /**
     * Called when a new package's important splits have finished downloading.
     *
     * Raised regardless of whether the boot timeout elapsed: when it did, the package is staged
     * and installs on the next Airborne initialization; when it did not, it is installed and
     * applied on this run.
     *
     * @param oldVersion The package version the app is currently running.
     * @param newVersion The package version that was just downloaded.
     *
     * @note Called on a background queue. Dispatch UI updates to the main queue.
     */
    @objc optional func onPackageDownloaded(oldVersion: String, newVersion: String)
}

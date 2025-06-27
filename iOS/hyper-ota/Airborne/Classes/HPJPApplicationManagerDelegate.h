//
//  HPJPApplicationManagerDelegate.h
//  HyperOTA
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#ifndef HPJPApplicationManagerDelegate_h
#define HPJPApplicationManagerDelegate_h

#import <Airborne/HPJPApplicationManifest.h>

/**
 * Protocol defining the interface for application manager delegates responsible for
 * fetching release configuration and providing application-specific settings.
 */
@protocol HPJPApplicationManagerDelegate <NSObject>

@optional

/**
 * Fetches the release configuration for a specific client.
 *
 * This method should retrieve the latest release configuration from the appropriate source
 * (typically a remote server), parse it into an HPJPApplicationManifest object, and invoke
 * the completion handler with the result.
 *
 * @param clientId The unique identifier for the client application requesting the configuration.
 *                 This ID is used to determine the appropriate configuration variant and
 *                 may affect URL construction, feature flags, or other client-specific settings.
 *
 * @param completionHandler A block to be called when the fetch operation completes.
 *                         The block takes two parameters:
 *                         - manifest: The parsed application manifest on success, nil on failure
 *                         - error: An error object on failure, nil on success
 *                         This block may be called on any queue and should handle thread safety accordingly.
 *
 * @warning The completion handler must be called exactly once, regardless of success or failure.
 *          While the application manager has a release config timeout mechanism that will
 *          eventually proceed with local configuration if no response is received.
 *
 * @note For testing purposes, implementations may provide mock data instead of making
 *       actual network requests.
 */
- (void)fetchReleaseConfigForClientId:(NSString * _Nonnull)clientId completionHandler:(HPJPReleaseConfigCompletionHandler _Nonnull)completionHandler;


/**
 * Returns the URL to use for fetching release configuration.
 *
 * This method allows the delegate to specify a custom URL for downloading
 * the release configuration instead of using the default URL pattern.
 * The URL should point to a valid release configuration endpoint that
 * returns JSON data compatible with HPJPApplicationManifest.
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
- (NSString * _Nonnull)getReleaseConfigURL;


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
- (NSDictionary<NSString *, NSString *>* _Nonnull)getReleaseConfigHeaders;


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
- (NSBundle * _Nonnull)getBaseBundle;


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
- (BOOL)shouldUseLocalAssets;


/**
 * Determines whether the application should perform force updates when packages are downloaded.
 *
 * @return YES if packages should be moved to main when downloads complete before timeout,
 *         NO otherwise. Default is YES.
 */
- (BOOL)shouldDoForceUpdate;

@end

#endif /* HPJPApplicationManagerDelegate_h */

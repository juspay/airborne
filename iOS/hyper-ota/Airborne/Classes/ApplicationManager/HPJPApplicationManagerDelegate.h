//
//  HPJPApplicationManagerDelegate.h
//  HyperOTA
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#ifndef HPJPApplicationManagerDelegate_h
#define HPJPApplicationManagerDelegate_h

#ifdef SPM_BUILD
#import "HPJPApplicationManifest.h"
#else
#import <Airborne/HPJPApplicationManifest.h>
#endif

/**
 * Protocol defining the interface for application manager delegates responsible for
 * fetching release configuration and providing application-specific settings.
 */
@protocol HPJPApplicationManagerDelegate <NSObject>

@required

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

@optional

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

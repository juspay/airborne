//
//  ApplicationManager.h
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#ifndef ApplicationManager_h
#define ApplicationManager_h

#import <WebKit/WKWebView.h>
#import <HyperCore/HPJPLoggerDelegate.h>

#ifdef SPM_BUILD
#import "HPJPApplicationManifest.h"
#import "HPJPApplicationManagerDelegate.h"
#else
#import <Airborne/HPJPApplicationManifest.h>
#import <Airborne/HPJPApplicationManagerDelegate.h>
#endif


@class HPJPSessionManager;

@interface HPJPDownloadResult : NSObject

@property (strong, nonatomic, readonly) NSString* _Nonnull result;
@property (strong, nonatomic, readonly) HPJPApplicationManifest* _Nonnull releaseConfig;
@property (strong, nonatomic, readonly) NSString* _Nullable error;

- (instancetype _Nullable)initWithManifest:(HPJPApplicationManifest* _Nonnull)releaseConfig result:(NSString* _Nonnull)result error:(NSString* _Nullable)error;

@end

typedef void (^PackagesCompletionHandler)(HPJPDownloadResult * _Nonnull);

NS_ASSUME_NONNULL_BEGIN

@interface HPJPApplicationManager : NSObject

/**
 * Returns a shared instance of HPJPApplicationManager for the specified workspace.
 * This method implements a singleton pattern per workspace, ensuring that only one manager
 * exists for each unique workspace identifier.
 *
 * @param workspace The workspace identifier used to isolate manager instances
 * @param delegate An object conforming to HPJPApplicationManagerDelegate
 * @param logger Optional logger delegate for tracking download progress, errors, and analytics.
 *
 * @note If a manager already exists for the workspace and meets reuse criteria, the existing
 *       instance is returned with the logger added to its tracker
 * @note A new manager is created if none exists or if the existing manager has failed/completed states
 */
+ (instancetype)getSharedInstanceWithWorkspace:(NSString *)workspace delegate:(id<HPJPApplicationManagerDelegate> _Nonnull)delegate logger:(id<HPJPLoggerDelegate> _Nullable)logger;


/**
 * Returns a shared instance of HPJPApplicationManager for the specified workspace.
 * This method implements a singleton pattern per workspace, ensuring that only one manager
 * exists for each unique workspace identifier.
 *
 * @param workspace The workspace identifier used to isolate manager instances
 * @param delegate An object conforming to HPJPApplicationManagerDelegate
 * @param logger Optional logger delegate for tracking download progress, errors, and analytics.
 *
 * @note If a manager already exists for the workspace and meets reuse criteria, the existing
 *       instance is returned with the logger added to its tracker
 * @note A new manager is created if none exists or if the existing manager has failed/completed states
 */
+ (instancetype)getSharedInstanceWithWorkspace:(NSString *)workspace
                                      delegate:(id<HPJPApplicationManagerDelegate> _Nonnull)delegate
                                        logger:(id<HPJPLoggerDelegate> _Nullable)logger
                                  fromAirborne:(BOOL)fromAirborne;

/**
 * Returns the current application manifest containing package, configuration, and resource information.
 * This method provides a snapshot of the current state of all managed components.
 *
 * @return HPJPApplicationManifest instance containing:
 *         - Current package information (version, important/lazy resources)
 *         - Current configuration (timeouts, properties)
 *         - Current resources (available files and their locations)
 *
 * @note The returned manifest represents the currently active/installed state,
 *       not necessarily the latest downloaded state
 * @note Safe to call from any thread during or after download operations
 */
- (HPJPApplicationManifest *)getCurrentApplicationManifest;


/** Returns the current download result indicating the overall status of package and resource operations.
 * This method provides comprehensive status information about all download activities.
 *
 * @return HPJPDownloadResult containing:
 *         - result: Status string ("OK", "ERROR", "PACKAGE_DOWNLOAD_FAILED", "PACKAGE_TIMEDOUT", "RELEASE_CONFIG_TIMEDOUT")
 *         - releaseConfig: Current application manifest
 *         - error: Detailed error message if any operation failed (nil for successful operations)
 *
 * @note Return values:
 *       - "OK": All critical downloads completed successfully
 *       - "ERROR": Release configuration download failed
 *       - "PACKAGE_DOWNLOAD_FAILED": Important package download failed
 *       - "PACKAGE_TIMEDOUT": Important package download exceeded boot timeout or is still in progress
 *       - "RELEASE_CONFIG_TIMEDOUT": Release configuration download exceeded release config timeout or is still in progress
 *
 * @note The result reflects the state of critical downloads needed for app startup
 * @note Lazy package downloads do not affect the overall result status
 */
- (HPJPDownloadResult *)getCurrentResult;


/**
 * Waits for packages and resources to be ready, with automatic timeout handling.
 * @param completion Block that will be called when packages are ready or when timeout occurs.
 */
- (void)waitForPackagesAndResourcesWithCompletion:(PackagesCompletionHandler)completion;


/**
 * Reads the content of a package file
 * @param fileName The name of the file to read
 * @return The content of the file as a string, or nil if the file couldn't be read
 */
- (NSString *)readPackageFile:(NSString *)fileName;


/**
 * Reads the content of a resource file
 * @param resourceFileName The name of the resource file to read
 * @return The content of the file as a string, or nil if the file couldn't be read
 */
- (NSString *)readResourceFile:(NSString *)resourceFileName;

/**
 * Returns the value of the current release config timeout
 */
- (NSNumber *)getReleaseConfigTimeout;

/**
 * Returns the value of the current package timeout
 */
-(NSNumber *)getPackageTimeout;

/**
 * Returns whether the release configuration download has completed.
 *
 * @return YES if the release config download has completed (either successfully or failed),
 *         NO if the release config download is still in progress
 */
- (BOOL)isReleaseConfigDownloadCompleted;


/**
 * Returns whether both important package downloads and resource downloads have completed.
 *
 * @return YES if both important packages and resources have completed downloading (successfully or failed),
 *         NO if either important packages or resources are still downloading
 */
- (BOOL)isPackageAndResourceDownloadCompleted;


/**
 * Returns whether important package downloads have completed.
 *
 * @return YES if important package downloads have completed (successfully or failed),
 *         NO if important package downloads are still in progress
 */
- (BOOL)isImportantPackageDownloadCompleted;


/**
 * Returns whether lazy package downloads have completed.
 *
 * @return YES if lazy package downloads have completed (successfully or failed),
 *         NO if lazy package downloads are still in progress
 */
- (BOOL)isLazyPackageDownloadCompleted;

/**
 * Returns whether resources downloads have completed.
 *
 * @return YES if resources downloads have completed (successfully or failed),
 *         NO if resources downloads are still in progress
 */
- (BOOL)isResourcesDownloadCompleted;

/**
 * Returns the full internal storage path for a package file.
 *
 * @param fileName The name of the package file to get the internal storage path for.
 *                 Should include the file extension (e.g., "index.js", "chunk1.js").
 *
 * @return The complete internal storage file system path to the specified package file.
 *         Returns the full path even if the file doesn't exist at that location.
 */
- (NSString *)getPathForPackageFile:(NSString *)fileName;

@end

NS_ASSUME_NONNULL_END

#endif /* ApplicationManager_h */

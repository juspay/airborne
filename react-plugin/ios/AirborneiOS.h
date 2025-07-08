#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@protocol AirborneReactDelegate <NSObject>

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
- (NSDictionary<NSString *, NSString *> *)getDimensions;

/**
 * Returns the namespace, an unique identifier of the app/sdk.
 *
 * This namespace is used to store the files in the internal storage.
 * and also to read the bundled release config.
 *
 * @return the namespace, an unique identifier of the app/sdk.
 *         If not implemented, defaults to an default.
 */
- (NSString *)getNamespace;


- (NSBundle *)getBundle;

/**
 * Called when the OTA boot process has completed successfully.
 *
 * This callback indicates that the application is ready to load the packages & resources
 *
 * @note This method is called on a background queue. Dispatch UI updates
 *       to the main queue if needed.
 * @note Boot completion occurs even if some downloads failed or timed out.
 *       Check the release configuration for actual status.
 */
- (void)onBootComplete:(NSString *) bundlePath;

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
- (void)onEventWithLevel:(NSString *)level
                   label:(NSString *)label
                     key:(NSString *)key
                   value:(NSDictionary<NSString *, id> *)value
                category:(NSString *)category
             subcategory:(NSString *)subcategory;

@end

typedef void (^HyperOTALazyDownloadCallback)(NSString *filePath, BOOL success);
typedef void (^HyperOTALazySplitsCallback)(BOOL success);

@interface AirborneiOS : NSObject

+ (instancetype)sharedInstanceWithNamespace:(NSString *)ns;

- (void) loadWithReleaseConfig:(NSString *) rcurl delegate:(id<AirborneReactDelegate>) delegate;
- (NSString *)getBundlePath;
- (NSString *)getFileContent:(NSString *)filePath;
- (NSString *)getReleaseConfig;

@end

NS_ASSUME_NONNULL_END

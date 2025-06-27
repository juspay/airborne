//
//  HyperOTAServices.h
//  HyperOTA
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <HyperCore/HPJPLoggerDelegate.h>
#import <Airborne/HPJPApplicationManagerDelegate.h>

NS_ASSUME_NONNULL_BEGIN

@interface HyperOTAServices : NSObject

/**
 Initializes HyperOTAServices with the given configuration and immediately starts the OTA manager.
 
 @param payload Dictionary containing configuration parameters
 @param logger Optional logger delegate for tracking events
 @param baseBundle The base bundle to use for fallback resources. Default is [NSBundle mainBundle]
 */
- (instancetype)initWithPayload:(NSDictionary *)payload
                 loggerDelegate:(id<HPJPLoggerDelegate> _Nullable)logger
                     baseBundle:(NSBundle * _Nullable)baseBundle;

/**
 Initializes HyperOTAServices with the given clientId and immediately starts the OTA manager.
 
 @param clientId App identifier (typically the app name in lower case)
 @param delegate An object conforming to HPJPApplicationManagerDelegate
 @param logger Optional logger delegate for tracking events
*/
- (instancetype)initWithClientId:(NSString *)clientId
                        delegate:(id<HPJPApplicationManagerDelegate>)delegate
                 loggerDelegate:(id<HPJPLoggerDelegate> _Nullable)logger;

/**
 Returns the processed bundle URL. Returns nil if the bundle cannot be loaded.
 */
- (NSURL * _Nullable)bundleURL;

/**
 Returns the bundle URL for the given payload and logger. Returns nil if the bundle cannot be loaded.
 
 @param payload Dictionary containing configuration parameters
 @param logger Optional logger delegate for tracking events
 */
+ (NSURL * _Nullable)bundleURL:(NSDictionary * _Nonnull)payload loggerDelegate:(id<HPJPLoggerDelegate> _Nullable)logger;

/**
 Triggers a download if an update is available and returns the downloaded bundle path upon completion (before the specified timeout).
 If no update is available or the download is not completed in time, returns the locally available file path from the base bundle provided.
 Returns nil if the bundle cannot be loaded.
 */
+ (NSURL * _Nullable)bundleURL:(NSDictionary * _Nonnull)payload loggerDelegate:(id<HPJPLoggerDelegate> _Nullable)logger baseBundle:(NSBundle * _Nonnull)baseBundle;


@end

NS_ASSUME_NONNULL_END

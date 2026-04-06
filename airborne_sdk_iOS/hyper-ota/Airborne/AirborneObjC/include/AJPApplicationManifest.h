//
//  AJPApplicationManifest.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#ifndef ApplicationManifest_h
#define ApplicationManifest_h

#import <Foundation/Foundation.h>
#if SWIFT_PACKAGE
#import "AJPApplicationConfig.h"
#import "AJPApplicationPackage.h"
#import "AJPApplicationResources.h"
#else
#import <Airborne/AJPApplicationConfig.h>
#import <Airborne/AJPApplicationPackage.h>
#import <Airborne/AJPApplicationResources.h>
#endif

NS_ASSUME_NONNULL_BEGIN

@interface AJPApplicationManifest : NSObject<NSSecureCoding>

@property (nonatomic, strong) AJPApplicationConfig *config;
@property (nonatomic, strong) AJPApplicationPackage *package;
@property (nonatomic, strong) AJPApplicationResources *resources;

- (instancetype _Nullable)initWithData:(NSData *)data error:(NSError**) jsonError;
- (NSDictionary *)toDictionary;
- (instancetype)initWithPackage:(AJPApplicationPackage*)package config:(AJPApplicationConfig*)config resources:(AJPApplicationResources*)resources;

@end

/**
 * Completion handler block type for release configuration fetch operations.
 *
 * @param manifest The successfully fetched and parsed application manifest/release config, or nil if an error occurred
 * @param error An error object describing what went wrong, or nil if the operation succeeded
 * @param didTimeout YES if the release config timeout occured before release config fetched
 */
typedef void (^AJPReleaseConfigCompletionHandler)(AJPApplicationManifest * _Nullable manifest, NSError * _Nullable error, BOOL didTimeout);


typedef NSDictionary<NSString*, AJPResource*> AppResources;
typedef NSMutableDictionary<NSString*, AJPResource*> MutableAppResources;

NS_ASSUME_NONNULL_END

#endif /* ApplicationManifest_h */

//
//  HPJPApplicationManifest.h
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#ifndef ApplicationManifest_h
#define ApplicationManifest_h

#import <Foundation/Foundation.h>
#import <HyperCore/HPJPFileUtil.h>
#ifdef SPM_BUILD
#import "HPJPApplicationConfig.h"
#import "HPJPApplicationPackage.h"
#import "HPJPApplicationResources.h"
#else
#import <Airborne/HPJPApplicationConfig.h>
#import <Airborne/HPJPApplicationPackage.h>
#import <Airborne/HPJPApplicationResources.h>
#endif

NS_ASSUME_NONNULL_BEGIN

@interface HPJPApplicationManifest : NSObject<NSSecureCoding>

@property (nonatomic, strong) HPJPApplicationConfig *config;
@property (nonatomic, strong) HPJPApplicationPackage *package;
@property (nonatomic, strong) HPJPApplicationResources *resources;

- (instancetype _Nullable)initWithData:(NSData *)data error:(NSError**) jsonError;
- (NSDictionary *)toDictionary;
- (instancetype)initWithPackage:(HPJPApplicationPackage*)package config:(HPJPApplicationConfig*)config resources:(HPJPApplicationResources*)resources;

@end

/**
 * Completion handler block type for release configuration fetch operations.
 *
 * @param manifest The successfully fetched and parsed application manifest/release config, or nil if an error occurred
 * @param error An error object describing what went wrong, or nil if the operation succeeded
 */
typedef void (^HPJPReleaseConfigCompletionHandler)(HPJPApplicationManifest * _Nullable manifest, NSError * _Nullable error);


typedef NSDictionary<NSString*, HPJPResource*> AppResources;
typedef NSMutableDictionary<NSString*, HPJPResource*> MutableAppResources;

NS_ASSUME_NONNULL_END

#endif /* ApplicationManifest_h */

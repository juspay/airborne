//
//  AJPApplicationResources.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>

#ifdef SPM_BUILD
#import "AJPResource.h"
#import "AJPFileUtil.h"
#else
#import <Airborne/AJPResource.h>
#import <Airborne/AJPFileUtil.h>
#endif

NS_ASSUME_NONNULL_BEGIN

@interface AJPApplicationResources : NSObject<NSSecureCoding>

@property (nonnull) NSDictionary<NSString*, AJPResource *>* resources;

- (instancetype _Nullable)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;
- (instancetype)initWithFileUtil:(AJPFileUtil *)fileUtil error:(NSError * _Nullable *)error;
- (id)toDictionary;

@end

NS_ASSUME_NONNULL_END

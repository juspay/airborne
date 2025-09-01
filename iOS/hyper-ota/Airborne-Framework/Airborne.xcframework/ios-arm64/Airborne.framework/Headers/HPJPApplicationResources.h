//
//  HPJPApplicationResources.h
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <HyperCore/HPJPFileUtil.h>
#ifdef SPM_BUILD
#import "HPJPResource.h"
#else
#import <Airborne/HPJPResource.h>
#endif

NS_ASSUME_NONNULL_BEGIN

@interface HPJPApplicationResources : NSObject<NSSecureCoding>

@property (nonnull) NSDictionary<NSString*, HPJPResource *>* resources;

- (instancetype _Nullable)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;
- (instancetype)initWithFileUtil:(HPJPFileUtil *)fileUtil error:(NSError * _Nullable *)error;
- (id)toDictionary;

@end

NS_ASSUME_NONNULL_END

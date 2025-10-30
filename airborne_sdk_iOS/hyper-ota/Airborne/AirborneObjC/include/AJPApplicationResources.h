//
//  AJPApplicationResources.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>

#if SWIFT_PACKAGE
#import "AJPResource.h"
#else
#import <Airborne/AJPResource.h>
#endif

NS_ASSUME_NONNULL_BEGIN

@interface AJPApplicationResources : NSObject<NSSecureCoding>

@property (nonnull) NSDictionary<NSString*, AJPResource *>* resources;

- (instancetype _Nullable)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;
- (id)toDictionary;

@end

NS_ASSUME_NONNULL_END

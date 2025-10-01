//
//  AJPApplicationConfig.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#if SWIFT_PACKAGE
#import "AJPFileUtil.h"
#else
#import <Airborne/AJPFileUtil.h>
#endif

NS_ASSUME_NONNULL_BEGIN

@interface AJPApplicationConfig : NSObject<NSSecureCoding>

@property (nonatomic, strong) NSString *version;
@property (nonatomic, strong) NSNumber *bootTimeout;
@property (nonatomic, strong, nullable) NSNumber* releaseConfigTimeout;
@property (nonatomic, strong) NSDictionary *properties;

- (instancetype _Nullable)initWithError:(NSError * _Nullable *) jsonError fileUtil:(AJPFileUtil *)fileUtil;
- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;
- (NSDictionary *)toDictionary;

@end

NS_ASSUME_NONNULL_END

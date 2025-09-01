//
//  HPJPApplicationConfig.h
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <HyperCore/HPJPFileUtil.h>

NS_ASSUME_NONNULL_BEGIN

@interface HPJPApplicationConfig : NSObject<NSSecureCoding>

@property (nonatomic, strong) NSString *version;
@property (nonatomic, strong) NSNumber *bootTimeout;
@property (nonatomic, strong, nullable) NSNumber* releaseConfigTimeout;
@property (nonatomic, strong) NSDictionary *properties;

- (instancetype _Nullable)initWithError:(NSError * _Nullable *) jsonError fileUtil:(HPJPFileUtil*)fileUtil;
- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;
- (NSDictionary *)toDictionary;

@end

NS_ASSUME_NONNULL_END

//
//  HPJPResource.h
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface HPJPResource : NSObject<NSSecureCoding>

@property (nonatomic, readonly, strong) NSURL *url;
@property (nonatomic, readonly, strong) NSString *filePath;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;

- (NSDictionary *)toDictionary;

@end

@interface HPJPLazyResource : HPJPResource

@property (nonatomic, readwrite) BOOL isDownloaded;

- (instancetype)initWithResource:(HPJPResource *)resource;
- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;
- (NSDictionary *)toDictionary;

@end

NS_ASSUME_NONNULL_END

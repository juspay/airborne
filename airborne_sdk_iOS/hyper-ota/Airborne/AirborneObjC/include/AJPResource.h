//
//  AJPResource.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AJPResource : NSObject<NSSecureCoding>

@property (nonatomic, readonly, strong) NSURL *url;
@property (nonatomic, readonly, strong) NSString *filePath;
@property (nonatomic, readonly, strong) NSString * _Nullable checksum;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;

- (NSDictionary *)toDictionary;

@end

@interface AJPLazyResource : AJPResource

@property (nonatomic, readwrite) BOOL isDownloaded;

- (instancetype)initWithResource:(AJPResource *)resource;
- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;
- (NSDictionary *)toDictionary;

@end

NS_ASSUME_NONNULL_END

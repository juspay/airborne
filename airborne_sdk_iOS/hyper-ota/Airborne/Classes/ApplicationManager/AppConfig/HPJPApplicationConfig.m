//
//  HPJPApplicationConfig.m
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "HPJPApplicationConfig.h"
#import "HPJPApplicationConstants.h"
#import <HyperCore/HPJPFileUtil.h>

@implementation HPJPApplicationConfig

+ (BOOL)supportsSecureCoding {
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder {
    self = [super init];
    if (self) {
        // Decode properties
        NSSet *stringClasses = [NSSet setWithObjects:[NSString class], nil];
        NSSet *numberClasses = [NSSet setWithObjects:[NSNumber class], nil];
        self.version = [aDecoder decodeObjectOfClasses:stringClasses forKey:@"version"];
        self.bootTimeout = [aDecoder decodeObjectOfClasses:numberClasses forKey:@"boot_timeout"];
        self.releaseConfigTimeout = [aDecoder decodeObjectOfClasses:numberClasses forKey:@"release_config_timeout"];
        NSSet *classes = [NSSet setWithObjects:[NSDictionary class], [NSNumber class], [NSArray class], [NSString class],nil];
        self.properties = [aDecoder decodeObjectOfClasses:classes forKey:@"properties"];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    
    if (self.version != nil) {
        [dict setObject:self.version forKey:@"version"];
    }
    
    if (self.bootTimeout != nil) {
        [dict setObject:self.bootTimeout forKey:@"boot_timeout"];
    }
    
    if (self.releaseConfigTimeout != nil) {
        [dict setObject:self.releaseConfigTimeout forKey:@"release_config_timeout"];
    }
    
    if (self.properties != nil) {
        [dict setObject:self.properties forKey:@"properties"];
    }
    
    return [NSDictionary dictionaryWithDictionary:dict];
}

- (void)encodeWithCoder:(NSCoder *)aCoder {
    // Encode properties
    [aCoder encodeObject:self.version forKey:@"version"];
    [aCoder encodeObject:self.bootTimeout forKey:@"boot_timeout"];
    [aCoder encodeObject:self.releaseConfigTimeout forKey:@"release_config_timeout"];
    [aCoder encodeObject:self.properties forKey:@"properties"];
}

- (void)defaultInitWithDictionary:(NSDictionary *)dictionary error:(NSError **)error {
    if (![dictionary isKindOfClass:[NSDictionary class]]) {
        if (error) {
            *error = [NSError errorWithDomain:@"ConfigError" code:100 userInfo:@{NSLocalizedDescriptionKey: @"Invalid dictionary"}];
        }
    }
    
    _version = dictionary[@"version"] ?: @"";
    
    if (![dictionary[@"boot_timeout"] isKindOfClass:[NSNumber class]]) {
        if (error) {
            *error = [NSError errorWithDomain:@"ConfigError" code:101 userInfo:@{NSLocalizedDescriptionKey: @"Invalid boot timeout"}];
        }
    }
    _bootTimeout = dictionary[@"boot_timeout"] ?: @(1000);
    
    if (![dictionary[@"release_config_timeout"] isKindOfClass:[NSNumber class]]) {
        if (error) {
            *error = [NSError errorWithDomain:@"ConfigError" code:102 userInfo:@{NSLocalizedDescriptionKey: @"Invalid release config timeout"}];
        }
    }
    _releaseConfigTimeout = dictionary[@"release_config_timeout"] ?: @(1000);
    
    if (![dictionary[@"properties"] isKindOfClass:[NSDictionary class]]) {
        if (error) {
            *error = [NSError errorWithDomain:@"ConfigError" code:103 userInfo:@{NSLocalizedDescriptionKey: @"Invalid properties"}];
        }
    }
    _properties = dictionary[@"properties"] ? dictionary[@"properties"] : @{};
}

- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError **)error {
    self = [super init];
    if (self) {
        [self defaultInitWithDictionary:dictionary error:error];
    }
    return self;
}

- (instancetype)initWithError:(NSError **)jsonError fileUtil:(HPJPFileUtil*)fileUtil{
    self = [super init];
    NSData *data = [fileUtil getFileFromBundle:APP_CONFIG_FILE_NAME];
    NSDictionary *jsonObject = data ? [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:jsonError] : [NSDictionary new];
    if (jsonObject && [jsonObject isKindOfClass:[NSDictionary class]]) {
        [self defaultInitWithDictionary:jsonObject error:jsonError];
    }
    return self;
}

@end

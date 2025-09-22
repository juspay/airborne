//
//  HPJPApplicationManifest.m
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "HPJPApplicationManifest.h"
#import <HyperCore/HPJPFileUtil.h>
#import "HPJPApplicationConstants.h"

@implementation HPJPApplicationManifest

- (void)defaultInitialization:(NSDictionary *)dictionary error:(NSError **)error {
    if (self) {
        if (![dictionary isKindOfClass:[NSDictionary class]]) {
            if (error) {
                *error = [NSError errorWithDomain:@"ApplicationManifestError" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid dictionary"}];
            }
            return;
        }
        
        _config = [[HPJPApplicationConfig alloc] initWithDictionary:dictionary[@"config"] error:error];
        if (*error != nil) {
            return;
        }
        
        _package = [[HPJPApplicationPackage alloc] initWithDictionary:dictionary[@"package"] error:error];
        
        _resources = [[HPJPApplicationResources alloc] initWithDictionary:dictionary[@"resources"] error:error];
    }
}

+ (BOOL)supportsSecureCoding {
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder {
    self = [super init];
    if (self) {
        // Decode properties
        self.package = [aDecoder decodeObjectOfClass:[HPJPApplicationPackage class] forKey:@"package"];
        self.config = [aDecoder decodeObjectOfClass:[HPJPApplicationConfig class] forKey:@"config"];
        self.resources = [aDecoder decodeObjectOfClass:[HPJPApplicationResources class] forKey:@"resources"];
    }
    return self;
}

- (instancetype)initWithData:(NSData *)data error:(NSError **)jsonError {
    self = [super init];
    if (self) {
        NSDictionary *jsonObject = [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:jsonError];
        
        if (jsonObject && [jsonObject isKindOfClass:[NSDictionary class]]) {
            [self defaultInitialization:jsonObject error:jsonError];
            return self;
        } else {
            return nil;
        }
    }
    return nil;
}

- (void)encodeWithCoder:(NSCoder *)aCoder {
    // Encode properties
    [aCoder encodeObject:self.package forKey:@"package"];
    [aCoder encodeObject:self.config forKey:@"config"];
    [aCoder encodeObject:self.resources forKey:@"resources"];
}

- (void)setPackage:(HPJPApplicationPackage *)app {
    if (app != nil) {
        _package = app;
    }
}

- (void)setConfig:(HPJPApplicationConfig *)config {
    if (config != nil) {
        _config = config;
    }
}

- (void)setResources:(HPJPApplicationResources *)resources {
    if (resources != nil) {
        _resources = resources;
    }
}

- (instancetype)initWithPackage:(HPJPApplicationPackage *)package config:(HPJPApplicationConfig *)config resources:(HPJPApplicationResources *)resources {
    self = [super init];
    if (self) {
        _package = package;
        _resources = resources;
        _config = config;
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"package": [_package toDictionary],
        @"config": [_config toDictionary],
        @"resources": [_resources toDictionary]
    };
}

@end

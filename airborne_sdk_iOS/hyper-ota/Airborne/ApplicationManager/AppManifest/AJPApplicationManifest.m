//
//  AJPApplicationManifest.m
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "AJPApplicationManifest.h"
#import "AJPApplicationConstants.h"

@implementation AJPApplicationManifest

- (void)defaultInitialization:(NSDictionary *)dictionary error:(NSError **)error {
    if (self) {
        if (![dictionary isKindOfClass:[NSDictionary class]]) {
            if (error) {
                *error = [NSError errorWithDomain:@"ApplicationManifestError" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid dictionary"}];
            }
            return;
        }
        
        _config = [[AJPApplicationConfig alloc] initWithDictionary:dictionary[@"config"] error:error];
        if (*error != nil) {
            return;
        }
        
        _package = [[AJPApplicationPackage alloc] initWithDictionary:dictionary[@"package"] error:error];
        
        _resources = [[AJPApplicationResources alloc] initWithDictionary:dictionary[@"resources"] error:error];
    }
}

+ (BOOL)supportsSecureCoding {
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder {
    self = [super init];
    if (self) {
        // Decode properties
        self.package = [aDecoder decodeObjectOfClass:[AJPApplicationPackage class] forKey:@"package"];
        self.config = [aDecoder decodeObjectOfClass:[AJPApplicationConfig class] forKey:@"config"];
        self.resources = [aDecoder decodeObjectOfClass:[AJPApplicationResources class] forKey:@"resources"];
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

- (void)setPackage:(AJPApplicationPackage *)app {
    if (app != nil) {
        _package = app;
    }
}

- (void)setConfig:(AJPApplicationConfig *)config {
    if (config != nil) {
        _config = config;
    }
}

- (void)setResources:(AJPApplicationResources *)resources {
    if (resources != nil) {
        _resources = resources;
    }
}

- (instancetype)initWithPackage:(AJPApplicationPackage *)package config:(AJPApplicationConfig *)config resources:(AJPApplicationResources *)resources {
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

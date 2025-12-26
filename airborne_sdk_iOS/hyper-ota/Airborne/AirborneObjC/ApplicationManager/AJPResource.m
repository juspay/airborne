//
//  AJPResource.m
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "AJPResource.h"

@implementation AJPResource

- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError **)error {
    self = [super init];
    if (self) {
        if (![dictionary isKindOfClass:[NSDictionary class]]) {
            if (error) {
                *error = [NSError errorWithDomain:@"ResourceError" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Invalid dictionary"}];
            }
            return nil;
        }
        
        // Parse URL
        NSString *urlString = dictionary[@"url"];
        if (![urlString isKindOfClass:[NSString class]]) {
            if (error) {
                *error = [NSError errorWithDomain:@"ResourceError" code:401 userInfo:@{NSLocalizedDescriptionKey: @"Invalid URL"}];
            }
            return nil;
        }
        _url = [NSURL URLWithString:urlString];
        
        // Parse filePath
        NSString *filePath = dictionary[@"filePath"];
        if (![filePath isKindOfClass:[NSString class]]) {
            if (error) {
                *error = [NSError errorWithDomain:@"ResourceError" code:402 userInfo:@{NSLocalizedDescriptionKey: @"Invalid filePath"}];
            }
            return nil;
        }
        _filePath = filePath;

        // Parse checksum
        NSString *checksum = dictionary[@"checksum"];
        if (checksum && ![checksum isKindOfClass:[NSString class]]) {
            if (error) {
                *error = [NSError errorWithDomain:@"ResourceError"
                                            code:403
                                        userInfo:@{NSLocalizedDescriptionKey: @"Invalid checksum"}];
            }
            return nil;
        }
        _checksum = checksum;
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = @{
        @"url": [_url absoluteString],
        @"file_path": _filePath
    }.mutableCopy;
    
    if (self.checksum) {
        dict[@"checksum"] = _checksum;
    }
    
    return dict;
}

+ (BOOL)supportsSecureCoding {
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder {
    self = [super init];
    if (self) {
        // For URL decoding, need to handle both NSURL and NSString
        NSSet *urlClasses = [NSSet setWithObjects:[NSURL class], [NSString class], nil];
        id urlObj = [aDecoder decodeObjectOfClasses:urlClasses forKey:@"url"];
        
        if ([urlObj isKindOfClass:[NSURL class]]) {
            _url = urlObj;
        } else if ([urlObj isKindOfClass:[NSString class]]) {
            _url = [NSURL URLWithString:urlObj];
        }
        
        // For filePath, we expect a string
        NSSet *stringClasses = [NSSet setWithObjects:[NSString class], nil];
        _filePath = [aDecoder decodeObjectOfClasses:stringClasses forKey:@"file_path"];
        
        // For checksum, handle nil case
        id checksumObj = [aDecoder decodeObjectOfClasses:stringClasses forKey:@"checksum"];
        _checksum = [checksumObj isKindOfClass:[NSString class]] ? checksumObj : nil;
    }
    return self;
}

- (void)encodeWithCoder:(NSCoder *)aCoder {
    [aCoder encodeObject:_url forKey:@"url"];
    [aCoder encodeObject:_filePath forKey:@"file_path"];
    
    if (_checksum) {
        [aCoder encodeObject:_checksum forKey:@"checksum"];
    }
}

@end

@implementation AJPLazyResource

- (instancetype)initWithResource:(AJPResource *)resource {
    // Create a dictionary from the base resource and initialize with it
    NSDictionary *resourceDict = [resource toDictionary];
    NSError *error = nil;
    return [self initWithDictionary:resourceDict error:&error];
}

- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError **)error {
    self = [super initWithDictionary:dictionary error:error];
    if (self) {
        // Initialize isDownloaded (default to NO unless specified)
        _isDownloaded = [dictionary[@"isDownloaded"] boolValue];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    // Start with the parent's dictionary
    NSMutableDictionary *dict = [[super toDictionary] mutableCopy];
    // Add our own property
    dict[@"isDownloaded"] = @(_isDownloaded);
    return dict;
}

+ (BOOL)supportsSecureCoding {
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder {
    self = [super initWithCoder:aDecoder];
    if (self) {
        _isDownloaded = [aDecoder decodeBoolForKey:@"isDownloaded"];
    }
    return self;
}

- (void)encodeWithCoder:(NSCoder *)aCoder {
    [super encodeWithCoder:aCoder];
    [aCoder encodeBool:_isDownloaded forKey:@"isDownloaded"];
}

@end

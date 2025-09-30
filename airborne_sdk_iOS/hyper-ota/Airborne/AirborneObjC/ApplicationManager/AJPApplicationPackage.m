//
//  HPJPApplicationPackages.m
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "AJPApplicationPackage.h"
#import "AJPApplicationConstants.h"

@implementation AJPApplicationPackage

- (NSDictionary *)toDictionary {
    NSMutableArray *importantDict = [NSMutableArray new];
    for (AJPResource *value in _important) {
        [importantDict addObject:[value toDictionary]];
    }
    
    NSMutableArray *lazyDict = [NSMutableArray new];
    for (AJPResource *value in _lazy) {
        [lazyDict addObject:[value toDictionary]];
    }
    
    return @{
        @"name": _name,
        @"version": _version,
        @"index": [_index toDictionary],
        @"properties": _properties,
        @"important": importantDict,
        @"lazy": lazyDict
    };
}

- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError **)error {
    self = [super init];
    if (self) {
        [self defaultInitWithDictionary:dictionary error:error];
    }
    return self;
}

- (void)defaultInitWithDictionary:(NSDictionary *)dictionary error:(NSError **)error {
    if (![dictionary isKindOfClass:[NSDictionary class]]) {
        if (error) {
            *error = [NSError errorWithDomain:@"ManifestError" code:300 userInfo:@{NSLocalizedDescriptionKey: @"Invalid dictionary"}];
        }
    }
    
    _name = dictionary[@"name"] ? dictionary[@"name"] : @"";
    _version = dictionary[@"version"] ? dictionary[@"version"] : @"";
    
    NSDictionary *indexDict = dictionary[@"index"];
    if ([indexDict isKindOfClass:[NSDictionary class]]) {
        _index = [[AJPResource alloc] initWithDictionary:indexDict error:nil];
    } else {
        if (error) {
            *error = [NSError errorWithDomain:@"ManifestError" code:301 userInfo:@{NSLocalizedDescriptionKey: @"Invalid index resource"}];
        }
    }
    
    _properties = dictionary[@"properties"] ? dictionary[@"properties"] : @{};
    
    
    NSArray *importantArray = dictionary[@"important"];
    if ([importantArray isKindOfClass:[NSArray class]]) {
        NSMutableArray<AJPResource *> *importantPackage = [NSMutableArray new];
        for (NSDictionary *value in importantArray) {
            [importantPackage addObject:[[AJPResource alloc] initWithDictionary:value error:error]];
        }
        _important = importantPackage;
    } else {
        _important = @[];
        if (error) {
            *error = [NSError errorWithDomain:@"ManifestError" code:302 userInfo:@{NSLocalizedDescriptionKey: @"Invalid important packages"}];
        }
    }
    
    NSArray *lazyArray = dictionary[@"lazy"];
    if ([lazyArray isKindOfClass:[NSArray class]]) {
        NSMutableArray<AJPLazyResource *> *lazyPackages = [NSMutableArray new];
        for (NSDictionary *value in lazyArray) {
            [lazyPackages addObject:[[AJPLazyResource alloc] initWithDictionary:value error:error]];
        }
        _lazy = lazyPackages;
    } else {
        _lazy = @[];
        if (error) {
            *error = [NSError errorWithDomain:@"ManifestError" code:303 userInfo:@{NSLocalizedDescriptionKey: @"Invalid lazy packages"}];
        }
    }
}

- (instancetype)initWithFileUtil:(AJPFileUtil*)fileUtil error:(NSError **)error {
    self = [super init];
    NSData *data = [fileUtil getFileDataFromBundle:APP_PACKAGE_FILE_NAME error:nil];
    NSDictionary *jsonObject = data ? [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:error] : [NSDictionary new];
    if (jsonObject && [jsonObject isKindOfClass:[NSDictionary class]]) {
        [self defaultInitWithDictionary:jsonObject error:error];
    }
    return self;
}

// Implement new methods for accessing splits
- (NSArray<AJPResource *> *)allImportantSplits {
    NSMutableArray<AJPResource *> *allSplits = [NSMutableArray array];
    if (self.index) {
        [allSplits addObject:self.index];
    }
    for (AJPResource *split in self.important) {
        [allSplits addObject:split];
    }
    return allSplits;
}

- (NSArray<AJPResource *> *)allLazySplits {
    NSMutableArray<AJPResource *> *allSplits = [NSMutableArray array];
    for (AJPResource *split in self.lazy) {
        [allSplits addObject:split];
    }
    return allSplits;
}

- (NSArray<AJPResource *> *)allSplits {
    return [[self allImportantSplits] arrayByAddingObjectsFromArray:[self allLazySplits]];
}

- (NSSet<NSString *> *)allImportantSplitsAsSet {
    NSMutableSet<NSString *> *allSplits = [NSMutableSet set];
    [allSplits addObject:_index.url.absoluteString];
    for (AJPResource *resource in self.important) {
        if (resource.url) {
            [allSplits addObject:resource.url.absoluteString];
        } else {
            return nil;
        }
    }
    return [allSplits copy];
}

- (NSSet<NSString *> *)allLazySplitsAsSet {
    NSMutableSet<NSString *> *allSplits = [NSMutableSet new];
    for (AJPResource *resource in self.lazy) {
        if (resource.url) {
            [allSplits addObject:resource.url.absoluteString];
        } else {
            return nil;
        }
    }
    return [allSplits copy];
}

- (NSSet<NSString *> *)allSplitsAsSet {
    return [[self allImportantSplitsAsSet] setByAddingObjectsFromSet:[self allLazySplitsAsSet]];
}

+ (BOOL)supportsSecureCoding {
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)decoder {
    self = [super init];
    if (self) {
        NSSet *stringClasses = [NSSet setWithObjects:[NSString class], nil];
        _name = [decoder decodeObjectOfClasses:stringClasses forKey:@"name"];
        _version = [decoder decodeObjectOfClasses:stringClasses forKey:@"version"];
        
        NSSet *indexClasses = [NSSet setWithObjects:[AJPResource class], nil];
        id index = [decoder decodeObjectOfClasses:indexClasses forKey:@"index"];
        if ([index isKindOfClass:[AJPResource class]]) {
            _index = index;
        }
        
        NSSet *propertyClasses = [NSSet setWithObjects:[NSDictionary class], [NSNumber class], [NSArray class], [NSString class],nil];
        _properties = [decoder decodeObjectOfClasses:propertyClasses forKey:@"properties"];
        NSSet* resourceArrayClasses = [NSSet setWithObjects:[NSArray class], [AJPResource class], nil];

        // For important array
        NSArray<id> *importantResources = [decoder decodeObjectOfClasses:resourceArrayClasses forKey:@"important"];
        NSMutableArray<AJPResource *> *importantArray = [NSMutableArray array];
        for (id item in importantResources) {
            if ([item isKindOfClass:[AJPResource class]]) {
                [importantArray addObject:item];
            }
        }
        _important = importantArray;

        // For lazy array
        NSSet* lazyResourceArrayClasses = [NSSet setWithObjects:[NSArray class], [AJPResource class], [AJPLazyResource class], nil];
        NSArray<id> *lazyResources = [decoder decodeObjectOfClasses:lazyResourceArrayClasses forKey:@"lazy"];
        NSMutableArray<AJPLazyResource *> *lazyArray = [NSMutableArray array];
        for (id item in lazyResources) {
            if ([item isKindOfClass:[AJPLazyResource class]]) {
                [lazyArray addObject:item];
            } else if ([item isKindOfClass:[AJPResource class]]) {
                // Convert AJPResource to AJPLazyResource if needed
                AJPResource *resource = item;
                AJPLazyResource *lazyResource = [[AJPLazyResource alloc] initWithResource:resource];
                [lazyArray addObject:lazyResource];
            }
        }
        _lazy = lazyArray;
    }
    return self;
}

- (void)encodeWithCoder:(NSCoder *)encoder {
    [encoder encodeObject:self.name forKey:@"name"];
    [encoder encodeObject:self.version forKey:@"version"];
    [encoder encodeObject:self.index forKey:@"index"];
    [encoder encodeObject:self.properties forKey:@"properties"];
    [encoder encodeObject:self.important forKey:@"important"];
    [encoder encodeObject:self.lazy forKey:@"lazy"];
}

@end

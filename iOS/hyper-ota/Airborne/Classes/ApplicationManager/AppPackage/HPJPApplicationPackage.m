//
//  HPJPApplicationPackages.m
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "HPJPApplicationPackage.h"
#import "HPJPApplicationConstants.h"

@implementation HPJPApplicationPackage

- (NSDictionary *)toDictionary {
    NSMutableArray *importantDict = [NSMutableArray new];
    for (HPJPResource *value in _important) {
        [importantDict addObject:[value toDictionary]];
    }
    
    NSMutableArray *lazyDict = [NSMutableArray new];
    for (HPJPResource *value in _lazy) {
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
        _index = [[HPJPResource alloc] initWithDictionary:indexDict error:nil];
    } else {
        if (error) {
            *error = [NSError errorWithDomain:@"ManifestError" code:301 userInfo:@{NSLocalizedDescriptionKey: @"Invalid index resource"}];
        }
    }
    
    _properties = dictionary[@"properties"] ? dictionary[@"properties"] : @{};
    
    
    NSArray *importantArray = dictionary[@"important"];
    if ([importantArray isKindOfClass:[NSArray class]]) {
        NSMutableArray<HPJPResource *> *importantPackage = [NSMutableArray new];
        for (NSDictionary *value in importantArray) {
            [importantPackage addObject:[[HPJPResource alloc] initWithDictionary:value error:error]];
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
        NSMutableArray<HPJPLazyResource *> *lazyPackages = [NSMutableArray new];
        for (NSDictionary *value in lazyArray) {
            [lazyPackages addObject:[[HPJPLazyResource alloc] initWithDictionary:value error:error]];
        }
        _lazy = lazyPackages;
    } else {
        _lazy = @[];
        if (error) {
            *error = [NSError errorWithDomain:@"ManifestError" code:303 userInfo:@{NSLocalizedDescriptionKey: @"Invalid lazy packages"}];
        }
    }
}

- (instancetype)initWithFileUtil:(HPJPFileUtil*)fileUtil error:(NSError **)error {
    self = [super init];
    NSData *data = [fileUtil getFileFromBundle:APP_PACKAGE_FILE_NAME];
    if (data == nil) {
        self.isDefaultInit = YES;
    }
    NSDictionary *jsonObject = data ? [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:error] : [NSDictionary new];
    if (jsonObject && [jsonObject isKindOfClass:[NSDictionary class]]) {
        [self defaultInitWithDictionary:jsonObject error:error];
    }
    return self;
}

// Implement new methods for accessing splits
- (NSArray<HPJPResource *> *)allImportantSplits {
    NSMutableArray<HPJPResource *> *allSplits = [NSMutableArray array];
    if (self.index) {
        [allSplits addObject:self.index];
    }
    for (HPJPResource *split in self.important) {
        [allSplits addObject:split];
    }
    return allSplits;
}

- (NSArray<HPJPResource *> *)allLazySplits {
    NSMutableArray<HPJPResource *> *allSplits = [NSMutableArray array];
    for (HPJPResource *split in self.lazy) {
        [allSplits addObject:split];
    }
    return allSplits;
}

- (NSArray<HPJPResource *> *)allSplits {
    return [[self allImportantSplits] arrayByAddingObjectsFromArray:[self allLazySplits]];
}

- (NSSet<NSString *> *)allImportantSplitsAsSet {
    NSMutableSet<NSString *> *allSplits = [NSMutableSet set];
    [allSplits addObject:_index.url.absoluteString];
    for (HPJPResource *resource in self.important) {
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
    for (HPJPResource *resource in self.lazy) {
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
        
        NSSet *indexClasses = [NSSet setWithObjects:[HPJPResource class], nil];
        id index = [decoder decodeObjectOfClasses:indexClasses forKey:@"index"];
        if ([index isKindOfClass:[HPJPResource class]]) {
            _index = index;
        }
        
        NSSet *propertyClasses = [NSSet setWithObjects:[NSDictionary class], [NSNumber class], [NSArray class], [NSString class],nil];
        _properties = [decoder decodeObjectOfClasses:propertyClasses forKey:@"properties"];
        NSSet* resourceArrayClasses = [NSSet setWithObjects:[NSArray class], [HPJPResource class], nil];

        // For important array
        NSArray<id> *importantResources = [decoder decodeObjectOfClasses:resourceArrayClasses forKey:@"important"];
        NSMutableArray<HPJPResource *> *importantArray = [NSMutableArray array];
        for (id item in importantResources) {
            if ([item isKindOfClass:[HPJPResource class]]) {
                [importantArray addObject:item];
            }
        }
        _important = importantArray;

        // For lazy array
        NSSet* lazyResourceArrayClasses = [NSSet setWithObjects:[NSArray class], [HPJPResource class], [HPJPLazyResource class], nil];
        NSArray<id> *lazyResources = [decoder decodeObjectOfClasses:lazyResourceArrayClasses forKey:@"lazy"];
        NSMutableArray<HPJPLazyResource *> *lazyArray = [NSMutableArray array];
        for (id item in lazyResources) {
            if ([item isKindOfClass:[HPJPLazyResource class]]) {
                [lazyArray addObject:item];
            } else if ([item isKindOfClass:[HPJPResource class]]) {
                // Convert HPJPResource to HPJPLazyResource if needed
                HPJPResource *resource = item;
                HPJPLazyResource *lazyResource = [[HPJPLazyResource alloc] initWithResource:resource];
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

//
//  AJPApplicationResources.m
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "AJPApplicationResources.h"
#import "AJPApplicationConstants.h"

@implementation AJPApplicationResources

#if TARGET_OS_IOS

+ (BOOL)supportsSecureCoding {
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder {
    self = [super init];
    if (self) {
        // Decode properties
        NSSet *classes = [NSSet setWithObjects:[NSDictionary class], [NSString class], [NSArray class], [NSNumber class], [NSString class], [AJPResource class],nil];
        self.resources = [aDecoder decodeObjectOfClasses:classes forKey:@"resources"];
    }
    return self;
}

- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError **)error {
    self = [super init];
    if (self && dictionary != nil) {
        [self defaultInitWithDict:dictionary error:error];
    }
    
    return self;
}

- (void)defaultInitWithDict:(NSDictionary *)resourcesDict error:(NSError **)error {
    NSMutableDictionary<NSString *, AJPResource *> *resources = [NSMutableDictionary new];
    for (NSDictionary *resourceDict in resourcesDict) {
        AJPResource *resource = [[AJPResource alloc] initWithDictionary:resourceDict error:error];
        if (*error != nil) {
            continue;
        }
        [resources setValue:resource forKey:resource.filePath];
    }
    self.resources = [resources copy];
}

- (instancetype)initWithFileUtil:(AJPFileUtil *)fileUtil error:(NSError **)error {
    self = [super init];
    NSData *data = [fileUtil getFileDataFromBundle:APP_RESOURCES_FILE_NAME error:nil];
    NSDictionary *jsonObject = data ? [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:error] : [NSDictionary new];
    if (jsonObject && [jsonObject isKindOfClass:[NSArray class]]) {
        [self defaultInitWithDict:jsonObject error:error];
    }
    return self;
}

- (void)encodeWithCoder:(NSCoder *)aCoder {
    [aCoder encodeObject:self.resources forKey:@"resources"];
}

- (id)toDictionary {
    NSMutableArray* array = [NSMutableArray new];
    for (NSString* key in self.resources) {
        [array addObject:[self.resources[key] toDictionary]];
    }
    return array;
}

#endif

@end

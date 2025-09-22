//
//  HPJPApplicationResources.m
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "HPJPApplicationResources.h"
#import "HPJPApplicationConstants.h"

@implementation HPJPApplicationResources

+ (BOOL)supportsSecureCoding {
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder {
    self = [super init];
    if (self) {
        // Decode properties
        NSSet *classes = [NSSet setWithObjects:[NSDictionary class], [NSString class], [NSArray class], [NSNumber class], [NSString class], [HPJPResource class],nil];
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
    NSMutableDictionary<NSString *, HPJPResource *> *resources = [NSMutableDictionary new];
    for (NSDictionary *resourceDict in resourcesDict) {
        HPJPResource *resource = [[HPJPResource alloc] initWithDictionary:resourceDict error:error];
        if (*error != nil) {
            continue;
        }
        [resources setValue:resource forKey:resource.filePath];
    }
    self.resources = [resources copy];
}

- (instancetype)initWithFileUtil:(HPJPFileUtil *)fileUtil error:(NSError **)error {
    self = [super init];
    NSData *data = [fileUtil getFileFromBundle:APP_RESOURCES_FILE_NAME];
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

@end

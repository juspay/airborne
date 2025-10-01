//
//  AJPApplicationPackage.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>

#if SWIFT_PACKAGE
#import "AJPResource.h"
#import "AJPFileUtil.h"
#else
#import <Airborne/AJPResource.h>
#import <Airborne/AJPFileUtil.h>
#endif


NS_ASSUME_NONNULL_BEGIN

@interface AJPApplicationPackage : NSObject<NSSecureCoding>

@property (nonatomic, strong) NSString *name;
@property (nonatomic, strong) NSString *version;
@property (nonatomic, strong) AJPResource *index;
@property (nonatomic, strong) NSDictionary *properties;

@property (nonatomic, strong) NSArray<AJPResource*> *important;
@property (nonatomic, strong) NSArray<AJPLazyResource*> *lazy;

- (instancetype _Nullable)initWithFileUtil:(AJPFileUtil *)fileUtil error:(NSError * _Nullable *)error;
- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;

- (NSArray<AJPResource *> *)allImportantSplits;
- (NSArray<AJPResource *> *)allLazySplits;
- (NSArray<AJPResource *> *)allSplits;

- (NSSet<NSString *> *)allImportantSplitsAsSet;
- (NSSet<NSString *> *)allLazySplitsAsSet;
- (NSSet<NSString *> *)allSplitsAsSet;

- (NSArray *)toDictionary;

@end

NS_ASSUME_NONNULL_END

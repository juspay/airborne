//
//  HPJPApplicationPackage.h
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <HyperCore/HPJPFileUtil.h>
#ifdef SPM_BUILD
#import "HPJPResource.h"
#else
#import <Airborne/HPJPResource.h>
#endif


NS_ASSUME_NONNULL_BEGIN

@interface HPJPApplicationPackage : NSObject<NSSecureCoding>

@property (nonatomic, strong) NSString *name;
@property (nonatomic, strong) NSString *version;
@property (nonatomic, strong) HPJPResource *index;
@property (nonatomic, strong) NSDictionary *properties;

@property (nonatomic, assign) BOOL isDefaultInit;

@property (nonatomic, strong) NSArray<HPJPResource*> *important;
@property (nonatomic, strong) NSArray<HPJPLazyResource*> *lazy;

- (instancetype _Nullable)initWithFileUtil:(HPJPFileUtil *)fileUtil error:(NSError * _Nullable *)error;
- (instancetype)initWithDictionary:(NSDictionary *)dictionary error:(NSError * _Nullable *)error;

- (NSArray<HPJPResource *> *)allImportantSplits;
- (NSArray<HPJPResource *> *)allLazySplits;
- (NSArray<HPJPResource *> *)allSplits;

- (NSSet<NSString *> *)allImportantSplitsAsSet;
- (NSSet<NSString *> *)allLazySplitsAsSet;
- (NSSet<NSString *> *)allSplitsAsSet;

- (NSArray *)toDictionary;

@end

NS_ASSUME_NONNULL_END

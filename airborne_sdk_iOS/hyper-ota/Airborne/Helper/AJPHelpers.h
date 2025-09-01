//
//  AJPHelpers.h
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AJPHelpers : NSObject

+ (NSString *)sha256ForData:(NSData *)data;

+ (NSString *)urlEncodedStringFor:(NSString *)string;

+ (NSData * _Nullable)dataFromJSON:(id)dict;

+ (NSInvocation * _Nullable)getInvocatorForSelectorString:(NSString *)selectorString className:(NSString *)className isInstanceMethod:(BOOL)isInstanceMethod target:(id)target arguments:(NSArray *)arguments;

@end

NS_ASSUME_NONNULL_END

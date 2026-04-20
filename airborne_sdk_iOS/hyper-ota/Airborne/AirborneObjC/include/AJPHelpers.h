//
//  AJPHelpers.h
//  Airborne
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AJPHelpersObjc : NSObject

+ (NSInvocation * _Nullable)getInvocatorForSelectorString:(NSString *)selectorString className:(NSString *)className isInstanceMethod:(BOOL)isInstanceMethod target:(id)target arguments:(NSArray *)arguments;

@end

NS_ASSUME_NONNULL_END

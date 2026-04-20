//
//  AJPHelpers.m
//  Airborne
//

#import "AJPHelpers.h"

@implementation AJPHelpersObjc

+ (NSInvocation *)getInvocatorForSelectorString:(NSString *)selectorString className:(NSString *)className isInstanceMethod:(BOOL)isInstanceMethod target:(id)target arguments:(NSArray *)arguments {
    SEL selector = NSSelectorFromString(selectorString);
    if (!selector) {
        return nil;
    }
    
    NSMethodSignature *methodSignature;
    if (isInstanceMethod) {
        methodSignature = [target instanceMethodSignatureForSelector:selector];
    } else {
        methodSignature = [target methodSignatureForSelector:selector];
    }
    
    if (!methodSignature) {
        return nil;
    }
    
    NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:methodSignature];
    [invocation setTarget:target];
    [invocation setSelector:selector];
    
    // Set arguments (starting from index 2, as 0 and 1 are reserved for target and selector)
    for (NSUInteger i = 0; i < arguments.count && i + 2 < methodSignature.numberOfArguments; i++) {
        id argument = arguments[i];
        [invocation setArgument:&argument atIndex:i + 2];
    }
    
    return invocation;
}

@end

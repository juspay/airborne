//
//  AJPHelpers.m
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import "AJPHelpers.h"
#import <CommonCrypto/CommonHMAC.h>

@implementation AJPHelpers

+ (NSString *)sha256ForData:(NSData *)data {
    
    uint8_t digest[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(data.bytes, (CC_LONG)data.length, digest);

    NSMutableString* output = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
    for(int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
        [output appendFormat:@"%02x", digest[i]];
    }
    
    return output;
}

+ (NSString *)urlEncodedStringFor:(NSString *)string {
    NSMutableString *output = [NSMutableString string];
    const unsigned char *source = (const unsigned char *)[string UTF8String];
    unsigned long sourceLen = strlen((const char *)source);
    for (int i = 0; i < sourceLen; ++i) {
        const unsigned char thisChar = source[i];
        if (thisChar == ' '){
            [output appendString:@"+"];
        } else if (thisChar == '.' || thisChar == '-' || thisChar == '_' || thisChar == '~' ||
                   (thisChar >= 'a' && thisChar <= 'z') ||
                   (thisChar >= 'A' && thisChar <= 'Z') ||
                   (thisChar >= '0' && thisChar <= '9')) {
            [output appendFormat:@"%c", thisChar];
        } else {
            [output appendFormat:@"%%%02X", thisChar];
        }
    }
    return output;
}

+ (NSData *)dataFromJSON:(id)dict {
    
    if (!dict) {
        return [NSData new];
    }
    
    NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:nil];
    return data.length>0?data:[NSData new];
}

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

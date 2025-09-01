//
//  AJPApplicationTracker.m
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "AJPApplicationTracker.h"
#import "AJPApplicationConstants.h"
#import "AJPHelpers.h"

@interface AJPApplicationTracker()

@property (nonatomic, strong) NSString* managerId;

@property (nonatomic, strong) NSString* workspace;

@property (nonatomic, strong) NSPointerArray* loggers;

@end

@implementation AJPApplicationTracker

- (instancetype)initWithManagerId:(NSString *)managerId workspace:(NSString *)workspace {
    self = [super init];
    if (self) {
        self.managerId = managerId;
        self.workspace = workspace;
    }
    return self;
}

- (void)addLogger:( id<AJPLoggerDelegate> _Nullable)logger {
    if (logger == nil) {
        return;
    }
    if (self.loggers == nil) {
        self.loggers = [NSPointerArray pointerArrayWithOptions:NSPointerFunctionsWeakMemory];
    }
    [self.loggers addPointer:(__bridge void *)logger];
}

- (void) trackInfo:(NSString*)key value:(NSMutableDictionary<NSString*,id>*)value {
    [self trackLog:key value:value level:@"info"];
}

- (void) trackError:(NSString*) key value:(NSMutableDictionary<NSString*,id>*)value {
    [self trackLog:key value:value level:@"error"];
}

- (void) trackLog:(NSString*)key value:(NSMutableDictionary<NSString*,id>*) value level:(NSString*) level{
    [self trackEventWithLevel:level label:@"ota_update" key:key value:value]; // what to do
}

- (void)trackEventWithLevel:(NSString *)level label:(NSString*)label key:(NSString *)key value:(NSMutableDictionary<NSString*,id>*)value {
    [self trackEventWithLevel:level label:label key:key value:value category:@"lifecycle" subcategory:APPL_MANAGER_SUB_CAT];
}

- (void)trackEventWithLevel:(NSString *)level label:(NSString *)label key:(NSString *)key value:(id)value category:(NSString *)category subcategory:(NSString *)subcategory {
    id finalValue = value;
    if ([value isKindOfClass:[NSMutableDictionary class]]) {
        value[@"appUpdateId"] = _managerId;
        finalValue  = value;
    } else if([value isKindOfClass:[NSDictionary class]]) {
        finalValue = [value mutableCopy];
        finalValue[@"appUpdateId"] = _managerId;

    } else if([value isKindOfClass:[NSString class]]) {
        finalValue = [NSMutableDictionary dictionary];
        finalValue[@"value"] = value;
        finalValue[@"appUpdateId"] = _managerId;

    }
    BOOL didSendLog = NO;
    for (NSUInteger i = 0; i < [self.loggers count]; i++) {
        id logger = [self.loggers pointerAtIndex:i];
        if(logger && [logger conformsToProtocol:@protocol(AJPLoggerDelegate)]) {
            didSendLog = YES;
            if ([logger respondsToSelector:@selector(trackEventWithLevel:label:key:value:category:subcategory:)]) {
                [logger trackEventWithLevel:level label:label key:key value:finalValue category:@"lifecycle" subcategory:APPL_MANAGER_SUB_CAT];
            }
        }
    }
    if(!didSendLog) {
        NSString *className = @"HPJPLogsManager";
        Class logsManagerClass = NSClassFromString(className);
        if (logsManagerClass) {
            NSString *selectorString = @"trackEventWithLevel:label:value:category:subcategory:workspace:";
            
            NSInvocation *invocation = [AJPHelpers getInvocatorForSelectorString:selectorString className:className isInstanceMethod:NO target:logsManagerClass arguments:@[level, label, finalValue, @"lifecycle", APPL_MANAGER_SUB_CAT, self.workspace]];
            [invocation invoke];
        }
    }
}

- (void)trackEventWithLevel:(NSString *)level label:(NSString *)label value:(id)value category:(NSString *)category subcategory:(NSString *)subcategory {
    NSLog(@"trackEventWithLevel without key");
}

@end

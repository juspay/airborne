//
//  HPJPApplicationTracker.h
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <HyperCore/HPJPLoggerDelegate.h>

NS_ASSUME_NONNULL_BEGIN

@interface HPJPApplicationTracker : NSObject <HPJPLoggerDelegate>

- (instancetype)initWithManagerId:(NSString *)managerId workspace:(NSString *)workspace;

- (void)addLogger:( id<HPJPLoggerDelegate> _Nullable)logger;

- (void)trackInfo:(NSString *)key value:(NSMutableDictionary<NSString *,id> *)value;

- (void)trackError:(NSString *)key value:(NSMutableDictionary<NSString *,id> *)value;

- (void)trackLog:(NSString *)key value:(NSMutableDictionary<NSString*,id> *) value level:(NSString *)level;

- (void)trackEventWithLevel:(NSString *)level label:(NSString*)label key:(NSString *)key value:(NSMutableDictionary<NSString*,id>*)value;

- (void)trackEventWithLevel:(NSString *)level label:(NSString *)label key:(NSString *)key value:(id)value category:(NSString *)category subcategory:(NSString *)subcategory;

@end

NS_ASSUME_NONNULL_END

//
//  AJPLoggerDelegate.h
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//


@protocol AJPLoggerDelegate <NSObject>

- (void)trackEventWithLevel:(NSString *)level label:(NSString *)label key:(NSString *)key value:(id)value category:(NSString *)category subcategory:(NSString *)subcategory;

@end

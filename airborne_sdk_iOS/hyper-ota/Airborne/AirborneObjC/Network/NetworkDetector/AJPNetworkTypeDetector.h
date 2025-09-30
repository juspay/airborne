//
//  AJPNetworkTypeDetector.h
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, AJPNetworkType) {
    NetworkTypeNoInternet,
    NetworkTypeWiFi,
    NetworkType2G,
    NetworkType3G,
    NetworkType4G,
    NetworkType5G,
    NetworkTypeUnknown
};

@interface AJPNetworkTypeDetector : NSObject

+ (AJPNetworkType)currentNetworkType;
+ (NSString *)currentNetworkTypeString;

@end

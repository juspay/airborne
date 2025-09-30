//
//  NetworkTypeDetector.m
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import "AJPNetworkTypeDetector.h"
#import <CoreTelephony/CTTelephonyNetworkInfo.h>
#import <SystemConfiguration/SystemConfiguration.h>

@implementation AJPNetworkTypeDetector

#if TARGET_OS_IOS

#pragma mark - Exposed

+ (AJPNetworkType)currentNetworkType {
    // Check if internet is reachable
    if (![self isInternetReachable]) {
        return NetworkTypeNoInternet;
    }
    
    // Check if connected via WiFi
    if ([self isConnectedViaWiFi]) {
        return NetworkTypeWiFi;
    }
    
    // Check cellular connection type
    return [self getCellularNetworkType];
}

+ (NSString *)currentNetworkTypeString {
    AJPNetworkType type = [self currentNetworkType];
    switch (type) {
        case NetworkTypeNoInternet:
            return @"No Internet";
        case NetworkTypeWiFi:
            return @"WiFi";
        case NetworkType2G:
            return @"2G";
        case NetworkType3G:
            return @"3G";
        case NetworkType4G:
            return @"4G/LTE";
        case NetworkType5G:
            return @"5G";
        case NetworkTypeUnknown:
        default:
            return @"Unknown";
    }
}

#pragma mark - Private Helpers

+ (BOOL)isInternetReachable {
    SCNetworkReachabilityRef reachability = SCNetworkReachabilityCreateWithName(NULL, "www.google.com");
    SCNetworkReachabilityFlags flags;
    BOOL success = SCNetworkReachabilityGetFlags(reachability, &flags);
    CFRelease(reachability);
    
    if (!success) {
        return NO;
    }
    
    BOOL isReachable = (flags & kSCNetworkReachabilityFlagsReachable) != 0;
    BOOL needsConnection = (flags & kSCNetworkReachabilityFlagsConnectionRequired) != 0;
    BOOL isNetworkReachable = (isReachable && !needsConnection);
    
    return isNetworkReachable;
}

+ (BOOL)isConnectedViaWiFi {
    SCNetworkReachabilityRef reachability = SCNetworkReachabilityCreateWithName(NULL, "www.google.com");
    SCNetworkReachabilityFlags flags;
    BOOL success = SCNetworkReachabilityGetFlags(reachability, &flags);
    CFRelease(reachability);
    
    if (!success) {
        return NO;
    }
    
    BOOL isReachable = (flags & kSCNetworkReachabilityFlagsReachable) != 0;
    BOOL isWWAN = (flags & kSCNetworkReachabilityFlagsIsWWAN) != 0;
    
    return (isReachable && !isWWAN);
}

+ (AJPNetworkType)getCellularNetworkType {
    CTTelephonyNetworkInfo *networkInfo = [[CTTelephonyNetworkInfo alloc] init];
    
    NSDictionary *serviceCurrentRadioAccessTechnology = [networkInfo serviceCurrentRadioAccessTechnology];
    
    for (NSString *service in serviceCurrentRadioAccessTechnology) {
        NSString *radioTech = serviceCurrentRadioAccessTechnology[service];
        AJPNetworkType type = [self networkTypeForRadioAccessTechnology:radioTech];
        if (type != NetworkTypeUnknown) {
            return type;
        }
    }
    
    return NetworkTypeUnknown;
}

+ (AJPNetworkType)networkTypeForRadioAccessTechnology:(NSString *)radioTech {
    if (!radioTech) {
        return NetworkTypeUnknown;
    }
    
    // 5G Technologies
    if (@available(iOS 14.1, *)) {
        if ([radioTech isEqualToString:CTRadioAccessTechnologyNR] ||
            [radioTech isEqualToString:CTRadioAccessTechnologyNRNSA]) {
            return NetworkType5G;
        }
    }
    
    // 4G/LTE Technologies
    if ([radioTech isEqualToString:CTRadioAccessTechnologyLTE]) {
        return NetworkType4G;
    }
    
    // 3G Technologies
    if ([radioTech isEqualToString:CTRadioAccessTechnologyWCDMA] ||
        [radioTech isEqualToString:CTRadioAccessTechnologyHSDPA] ||
        [radioTech isEqualToString:CTRadioAccessTechnologyHSUPA] ||
        [radioTech isEqualToString:CTRadioAccessTechnologyCDMA1x] ||
        [radioTech isEqualToString:CTRadioAccessTechnologyCDMAEVDORev0] ||
        [radioTech isEqualToString:CTRadioAccessTechnologyCDMAEVDORevA] ||
        [radioTech isEqualToString:CTRadioAccessTechnologyCDMAEVDORevB] ||
        [radioTech isEqualToString:CTRadioAccessTechnologyeHRPD]) {
        return NetworkType3G;
    }
    
    // 2G Technologies
    if ([radioTech isEqualToString:CTRadioAccessTechnologyGPRS] ||
        [radioTech isEqualToString:CTRadioAccessTechnologyEdge]) {
        return NetworkType2G;
    }
    
    return NetworkTypeUnknown;
}

#endif

@end

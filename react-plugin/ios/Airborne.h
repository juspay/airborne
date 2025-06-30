#ifdef RCT_NEW_ARCH_ENABLED
#import <AirborneSpec/AirborneSpec.h>

@interface Airborne : NSObject <NativeAirborneSpec>
#else
#import <React/RCTBridgeModule.h>

@interface Airborne : NSObject <RCTBridgeModule>
#endif

+ (void)initializeAirborneWithAppId:(NSString *)appId
                       indexFileName:(NSString *)indexFileName
                          appVersion:(NSString *)appVersion
             releaseConfigTemplateUrl:(NSString *)releaseConfigTemplateUrl
                             headers:(nullable NSDictionary<NSString *, NSString *> *)headers;

@end

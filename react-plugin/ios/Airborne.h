#import "AirborneiOS.h"
#ifdef RCT_NEW_ARCH_ENABLED
#import <AirborneSpec/AirborneSpec.h>

@interface Airborne : NSObject <NativeAirborneSpec>
#else
#import <React/RCTBridgeModule.h>


@interface Airborne : NSObject <RCTBridgeModule>
#endif

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *) releaseConfigUrl;

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *) releaseConfigUrl
                                   inNamespace:(NSString *) ns;

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl
                                      delegate:delegate;

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *) releaseConfigUrl
                                   inNamespace:(NSString *) ns
                                      delegate:(id<AirborneReactDelegate>) delegate;

@end

#import "Airborne.h"
#ifdef RCT_NEW_ARCH_ENABLED
#import <AirborneSpec/AirborneSpec.h>
#import <Airborne/Airborne-Swift.h>

@interface AirborneReact : NSObject <NativeAirborneSpec>
#else
#import <React/RCTBridgeModule.h>


@interface AirborneReact : NSObject <RCTBridgeModule>
#endif

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *) releaseConfigUrl;

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *) releaseConfigUrl
                                   inNamespace:(NSString *) ns;

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl
                                      delegate:delegate;

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *) releaseConfigUrl
                                   inNamespace:(NSString *) ns
                                      delegate:(id<AirborneDelegate>) delegate;

@end

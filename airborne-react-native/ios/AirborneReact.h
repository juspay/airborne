#import "Airborne.h"
// RCTEventEmitter supplies addListener:/removeListeners:, which both the codegen'd spec and
// NativeEventEmitter require, and works under the old and new architectures alike.
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <AirborneSpec/AirborneSpec.h>
#import <Airborne/Airborne-Swift.h>

@interface AirborneReact : RCTEventEmitter <NativeAirborneSpec>
#else
#import <React/RCTBridgeModule.h>


@interface AirborneReact : RCTEventEmitter <RCTBridgeModule>
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

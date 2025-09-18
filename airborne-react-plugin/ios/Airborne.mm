#import "Airborne.h"
#import "AirborneiOS.h"
#import <React/RCTLog.h>
#import <Airborne/Airborne.h>
#import <Airborne/Airborne-Swift.h>

@implementation Airborne

RCT_EXPORT_MODULE(Airborne)

static NSString * const defaultNamespace = @"default";

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl {
    [self initializeAirborneWithReleaseConfigUrl:releaseConfigUrl inNamespace:defaultNamespace];
}

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl inNamespace:ns {
    AirborneiOS* air = [AirborneiOS sharedInstanceWithNamespace:ns];
    [air loadWithReleaseConfig:releaseConfigUrl delegate:nil];
}

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl delegate:delegate {
    AirborneiOS* air = [AirborneiOS sharedInstanceWithNamespace:defaultNamespace];
    [air loadWithReleaseConfig:releaseConfigUrl delegate:delegate];
}

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl inNamespace:ns delegate:delegate {
    AirborneiOS* air = [AirborneiOS sharedInstanceWithNamespace:ns];
    [air loadWithReleaseConfig:releaseConfigUrl delegate:delegate];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (void)readReleaseConfig:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *config = [[AirborneiOS sharedInstanceWithNamespace:defaultNamespace] getReleaseConfig];
        resolve(config);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

- (void)getFileContent:(NSString *)filePath
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *content = [[AirborneiOS sharedInstanceWithNamespace:defaultNamespace] getFileContent:filePath];
        resolve(content);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

- (void)getBundlePath:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *bundlePath = [[AirborneiOS sharedInstanceWithNamespace:defaultNamespace] getBundlePath];
        resolve(bundlePath);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}
#else
RCT_EXPORT_METHOD(readReleaseConfig:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *config = [[AirborneiOS sharedInstanceWithNamespace:defaultNamespace] getReleaseConfig];
        resolve(config);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getFileContent:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *content = [[AirborneiOS sharedInstanceWithNamespace:defaultNamespace] getFileContent:filePath];
        resolve(content);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getBundlePath:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *bundlePath = [[AirborneiOS sharedInstanceWithNamespace:defaultNamespace] getBundlePath];
        resolve(bundlePath);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}
#endif

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAirborneSpecJSI>(params);
}
#endif

@end

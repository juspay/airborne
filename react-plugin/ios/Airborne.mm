#import "Airborne.h"
#import "AirborneiOS.h"
#import <React/RCTLog.h>
#import <Airborne/Airborne.h>
#import <Airborne/Airborne-Swift.h>

@implementation Airborne

RCT_EXPORT_MODULE(Airborne)

+ (void)initializeAirborneWithAppId:(NSString *)appId
                       indexFileName:(NSString *)indexFileName
                          appVersion:(NSString *)appVersion
             releaseConfigTemplateUrl:(NSString *)releaseConfigTemplateUrl
                             headers:(nullable NSDictionary<NSString *, NSString *> *)headers {
    
    [[AirborneServices alloc] initWithReleaseConfigURL:@"" delegate:nil];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (void)readReleaseConfig:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *config = [[AirborneiOS sharedInstance] getReleaseConfig];
        resolve(config);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

- (void)getFileContent:(NSString *)filePath
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *content = [[AirborneiOS sharedInstance] getFileContent:filePath];
        resolve(content);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

- (void)getBundlePath:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *bundlePath = [[AirborneiOS sharedInstance] getBundlePath];
        resolve(bundlePath);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}
#else
RCT_EXPORT_METHOD(readReleaseConfig:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *config = [[AirborneiOS sharedInstance] getReleaseConfig];
        resolve(config);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getFileContent:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *content = [[AirborneiOS sharedInstance] getFileContent:filePath];
        resolve(content);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getBundlePath:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *bundlePath = [[AirborneiOS sharedInstance] getBundlePath];
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

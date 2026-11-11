#import "AirborneReact.h"
#import "Airborne.h"
#import <React/RCTLog.h>
#import <Airborne/Airborne-Swift.h>

@implementation AirborneReact

RCT_EXPORT_MODULE(Airborne)

static NSString * const defaultNamespace = @"default";

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl {
    [self initializeAirborneWithReleaseConfigUrl:releaseConfigUrl inNamespace:defaultNamespace];
}

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl inNamespace:ns {
    AJPApplicationManager* manager = [AJPApplicationManager getSharedInstanceWithWorkspace:ns delegate:nil logger:nil];
}

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl delegate:delegate {
    AJPApplicationManager* manager = [AJPApplicationManager getSharedInstanceWithWorkspace:defaultNamespace delegate:delegate logger:nil];
}

+ (void)initializeAirborneWithReleaseConfigUrl:(NSString *)releaseConfigUrl inNamespace:ns delegate:delegate {
    AJPApplicationManager* manager = [AJPApplicationManager getSharedInstanceWithWorkspace:ns delegate:delegate logger:nil];
}

static NSString * const AirborneErrorCode = @"AIRBORNE_ERROR";

/// Manager already created for `ns`; rejects the promise and returns nil when there is none.
static AJPApplicationManager *ExistingManager(NSString *ns, RCTPromiseRejectBlock reject) {
    AJPApplicationManager *manager = [AJPApplicationManager existingInstanceWithWorkspace:ns];
    if (!manager) {
        reject(AirborneErrorCode, @"Unknown Airborne namespace", nil);
    }
    return manager;
}

#ifdef RCT_NEW_ARCH_ENABLED
- (void)markBootSuccess:(NSString *)ns resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#else
RCT_EXPORT_METHOD(markBootSuccess:(NSString *)ns resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
#endif
    @try {
        AJPApplicationManager *manager = ExistingManager(ns, reject);
        if (!manager) {
            return;
        }
        [manager markBootSuccess];
        resolve(nil);
    } @catch (NSException *exception) {
        reject(AirborneErrorCode, exception.reason, nil);
    }
}

#ifdef RCT_NEW_ARCH_ENABLED
- (void)readReleaseConfig:(NSString *)ns resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#else
RCT_EXPORT_METHOD(readReleaseConfig:(NSString *)ns resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
#endif
    @try {
        AJPApplicationManager *manager = ExistingManager(ns, reject);
        if (!manager) {
            return;
        }
        NSString *releaseConfig = [manager currentReleaseConfigJSONPrettyPrinted:NO];
        if (!releaseConfig) {
            reject(AirborneErrorCode, @"Cannot serialize release config", nil);
            return;
        }
        resolve(releaseConfig);
    } @catch (NSException *exception) {
        reject(AirborneErrorCode, exception.reason, nil);
    }
}

#ifdef RCT_NEW_ARCH_ENABLED
- (void)getFileContent:(NSString *)ns filePath:(NSString *)filePath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#else
RCT_EXPORT_METHOD(getFileContent:(NSString *)ns filePath:(NSString *)filePath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
#endif
    @try {
        AJPApplicationManager *manager = ExistingManager(ns, reject);
        if (!manager) {
            return;
        }
        NSString *content = [manager readPackageFile:filePath];
        if (!content) {
            reject(AirborneErrorCode, @"Cannot read package file", nil);
            return;
        }
        resolve(content);
    } @catch (NSException *exception) {
        reject(AirborneErrorCode, exception.reason, nil);
    }
}

#ifdef RCT_NEW_ARCH_ENABLED
- (void)getBundlePath:(NSString *)ns resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#else
RCT_EXPORT_METHOD(getBundlePath:(NSString *)ns resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
#endif
    @try {
        AJPApplicationManager *manager = ExistingManager(ns, reject);
        if (!manager) {
            return;
        }
        // Same resolution as AirborneServices.getIndexBundlePath(); the host index name comes from
        // the manager's delegate (AirborneServices forwards AirborneDelegate.indexBundleName).
        // JS only reads the path here, so this does not record a boot for the boot guard.
        resolve([manager currentIndexBundleURL].absoluteString);
    } @catch (NSException *exception) {
        reject(AirborneErrorCode, exception.reason, nil);
    }
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAirborneSpecJSI>(params);
}
#endif

@end

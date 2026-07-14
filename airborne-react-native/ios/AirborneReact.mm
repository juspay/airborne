#import "AirborneReact.h"
#import "Airborne.h"
#import <React/RCTLog.h>
#import <Airborne/Airborne-Swift.h>

@implementation AirborneReact {
    /// Highest percentage handed to JS. Guards against the SDK's concurrent download threads
    /// delivering adjacent percentages out of order. `-1` so a genuine 0% still emits.
    NSInteger _lastEmittedPercent;
}

RCT_EXPORT_MODULE(Airborne)

static NSString * const defaultNamespace = @"default";

/// Posted by the Airborne SDK as the blocking set downloads. Matched by name rather than by
/// importing the SDK's constant, exactly as AirborneServices does for AJPLazyPackageNotification.
static NSString * const kDownloadProgressNotification = @"AJPDownloadProgressNotification";
static NSString * const kDownloadProgressEvent = @"onDownloadProgress";

/// The OTA download starts before the JS bundle loads, and on the boot-timeout path keeps
/// running after the app has booted on the previous package. Cache the latest value from image
/// load so a JS listener subscribing mid-download immediately learns where the update has got
/// to, instead of waiting for the next tick (or, if it already finished, never hearing anything).
///
/// This is a constructor rather than `+load` because RCT_EXPORT_MODULE already defines `+load`
/// on this class. It runs before `main`, and therefore long before the SDK is initialized in
/// `application:didFinishLaunchingWithOptions:`.
static NSDictionary *sLastProgress = nil;
static NSLock *sLastProgressLock = nil;

__attribute__((constructor)) static void AirborneReactObserveDownloadProgress(void) {
    sLastProgressLock = [NSLock new];
    [[NSNotificationCenter defaultCenter] addObserverForName:kDownloadProgressNotification
                                                      object:nil
                                                       queue:nil
                                                  usingBlock:^(NSNotification *note) {
        [sLastProgressLock lock];
        sLastProgress = note.userInfo;
        [sLastProgressLock unlock];
    }];
}

- (instancetype)init {
    if (self = [super init]) {
        _lastEmittedPercent = -1;
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - RCTEventEmitter

- (NSArray<NSString *> *)supportedEvents {
    return @[kDownloadProgressEvent];
}

- (void)startObserving {
    // Only ever called on the 0 -> 1 listener transition, so a fresh subscriber always receives
    // the replayed value below rather than having it filtered out as "not an advance".
    @synchronized (self) {
        _lastEmittedPercent = -1;
    }

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleDownloadProgress:)
                                                 name:kDownloadProgressNotification
                                               object:nil];

    [sLastProgressLock lock];
    NSDictionary *last = sLastProgress;
    [sLastProgressLock unlock];
    if (last != nil) {
        [self emitDownloadProgress:last];
    }
}

- (void)stopObserving {
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:kDownloadProgressNotification
                                                  object:nil];
}

- (void)handleDownloadProgress:(NSNotification *)notification {
    [self emitDownloadProgress:notification.userInfo];
}

- (void)emitDownloadProgress:(NSDictionary *)userInfo {
    if (userInfo == nil) {
        return;
    }

    NSNumber *percent = userInfo[@"percent"] ?: @0;
    @synchronized (self) {
        if (percent.integerValue <= _lastEmittedPercent) {
            return;
        }
        _lastEmittedPercent = percent.integerValue;
    }

    [self sendEventWithName:kDownloadProgressEvent body:@{
        @"bytesDownloaded": userInfo[@"bytesDownloaded"] ?: @0,
        @"totalBytes": userInfo[@"totalBytes"] ?: @0,
        @"percent": percent
    }];
}

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

#ifdef RCT_NEW_ARCH_ENABLED
- (void)readReleaseConfig:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *config = [[Airborne sharedInstanceWithNamespace:defaultNamespace] getReleaseConfig];
        resolve(config);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

- (void)getFileContent:(NSString *)filePath
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *content = [[Airborne sharedInstanceWithNamespace:defaultNamespace] getFileContent:filePath];
        resolve(content);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

- (void)getBundlePath:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *bundlePath = [[Airborne sharedInstanceWithNamespace:defaultNamespace] getBundlePath];
        resolve(bundlePath);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}
#else
RCT_EXPORT_METHOD(readReleaseConfig:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *config = [[Airborne sharedInstanceWithNamespace:defaultNamespace] getReleaseConfig];
        resolve(config);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getFileContent:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *content = [[Airborne sharedInstanceWithNamespace:defaultNamespace] getFileContent:filePath];
        resolve(content);
    } @catch (NSException *exception) {
        reject(@"AIRBORNE_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getBundlePath:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *bundlePath = [[Airborne sharedInstanceWithNamespace:defaultNamespace] getBundlePath];
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

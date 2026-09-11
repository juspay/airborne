
#import "Airborne.h"

@interface Airborne() <AirborneDelegate>

@property (nonatomic, strong) NSString* namespace;
@property (nonatomic, strong) AirborneServices* airborne;

@end

@implementation Airborne

+ (instancetype)sharedInstanceWithNamespace:(NSString *)aNamespace {
    static NSMutableDictionary<NSString *, Airborne *> *instances = nil;
    static dispatch_queue_t syncQueue;
    static dispatch_once_t onceToken;
    
    // Initialize dictionary and queue once
    dispatch_once(&onceToken, ^{
        instances = [NSMutableDictionary dictionary];
        syncQueue = dispatch_queue_create("in.juspay.Airborne.singleton", DISPATCH_QUEUE_CONCURRENT);
    });
    
    __block Airborne *instance = nil;
    
    // Read existing instance (concurrent)
    dispatch_sync(syncQueue, ^{
        instance = instances[aNamespace];
    });
    
    if (instance == nil) {
        // Write new instance (barrier to prevent concurrent writes)
        dispatch_barrier_sync(syncQueue, ^{
            if (!instances[aNamespace]) {
                instances[aNamespace] = [[self alloc] initWithNamespace:aNamespace];
            }
            instance = instances[aNamespace];
        });
    }
    
    return instance;
}

- (instancetype)initWithNamespace:(NSString *)namespace {
    self = [super init];
    if (self) {
        self.namespace = namespace;
    }
    return self;
}

- (instancetype)initWithReleaseConfigURL:(NSString *)releaseConfigURL delegate:(id<AirborneDelegate>)delegate {
    return [self initWithReleaseConfigURL:releaseConfigURL delegate:delegate shouldUpdate:YES];
}

- (instancetype)initWithReleaseConfigURL:(NSString *)releaseConfigURL delegate:(id<AirborneDelegate>)delegate shouldUpdate:(BOOL)shouldUpdate {
    self = [super init];
    if (self) {
        self.airborne = [[AirborneServices alloc] initWithReleaseConfigURL:releaseConfigURL delegate:delegate ?: self shouldUpdate:shouldUpdate];
    }
    return self;
}

- (NSString *)getBundlePath {
    return [self.airborne getIndexBundlePath].absoluteString;
}

- (NSString *)getFileContent:(NSString *)filePath {
    return [self.airborne getFileContentAtPath:filePath];
}

- (NSString *)getReleaseConfig {
    return [self.airborne getReleaseConfig];
}

- (void)checkForUpdate:(void (^)(NSString * _Nonnull))completion {
    if (!self.airborne) {
        completion(@"{\"updateAvailable\":false,\"error\":\"Airborne is not initialized\"}");
        return;
    }
    [self.airborne checkForUpdate:completion];
}

#pragma mark - AirborneDelegate

- (NSString *)namespace {
    return @"default";
}

@end

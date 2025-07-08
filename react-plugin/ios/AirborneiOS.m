#import "AirborneiOS.h"
#import "Airborne/Airborne.h"


@interface AirborneLocalDelegate : NSObject<AirborneDelegate>
@property (nonatomic, weak) NSString* ns;
@property (nonatomic, weak) id<AirborneReactDelegate> delegate;
-(instancetype)initWithNamespace:(NSString*) ns
                        delegate:(id<AirborneReactDelegate>) delegate;
@end

@implementation AirborneLocalDelegate

-(instancetype)initWithNamespace:(NSString*) ns delegate:(id<AirborneReactDelegate>) del {
    self = [super init];
    if (self) {
        _ns = ns;
        _delegate = del;
    }
    return self;
}

- (NSString *)namespace{
    if(_delegate == nil) return @"default";
    return [_delegate getNamespace];
}

- (NSBundle *)bundle{
    if(_delegate == nil) return NSBundle.mainBundle;
    return [_delegate getBundle];
}

- (NSDictionary *)dimensions{
    if(_delegate == nil) return @{};
    return [_delegate getDimensions];
}

- (void)onBootCompleteWithIndexBundlePath:(NSString *)indexBundlePath{
    if (_delegate == nil) return;
    [_delegate onBootComplete:indexBundlePath];
}

-(void)onEventWithLevel:(NSString *)level label:(NSString *)label key:(NSString *)key value:(NSDictionary<NSString *,id> *)value category:(NSString *)category subcategory:(NSString *)subcategory{
    if (_delegate == nil) return;
    [_delegate onEventWithLevel:level label:label key:key value:value category:category subcategory:subcategory];
}

@end


@interface AirborneiOS ()
@property (nonatomic, strong) NSString* ns;
@property (nonatomic, strong) AirborneServices* air;
@property (nonatomic, strong) id<AirborneDelegate> delegate;
@property (nonatomic, strong) AirborneLocalDelegate* delegateproxy;

@end

@implementation AirborneiOS

+ (instancetype)sharedInstanceWithNamespace:(NSString *)namespace{
    static NSMutableDictionary<NSString *, AirborneiOS *> *instances = nil;
    static dispatch_queue_t syncQueue;
    static dispatch_once_t onceToken;

    // Initialize dictionary and queue once
    dispatch_once(&onceToken, ^{
        instances = [NSMutableDictionary dictionary];
        syncQueue = dispatch_queue_create("in.juspay.Airborne.singleton", DISPATCH_QUEUE_CONCURRENT);
    });

    __block AirborneiOS *instance = nil;

    // Read existing instance (concurrent)
    dispatch_sync(syncQueue, ^{
        instance = instances[namespace];
    });

    if (instance == nil) {
        // Write new instance (barrier to prevent concurrent writes)
        dispatch_barrier_sync(syncQueue, ^{
            if (!instances[namespace]) {
                instances[namespace] = [[self alloc] initWithNamespace:namespace];
            }
            instance = instances[namespace];
        });
    }

    return instance;
}


- (instancetype)initWithNamespace:(NSString *) ns{
    self = [super init];
    if (self) {
        _ns = ns;
        
    }
    return self;
}

- (void)loadWithReleaseConfig:(NSString *) rcurl delegate:(id<AirborneReactDelegate>) delegate{
    _delegateproxy = [[AirborneLocalDelegate alloc] initWithNamespace: self.ns delegate:delegate];
    _air = [[AirborneServices alloc] initWithReleaseConfigURL:rcurl delegate:_delegateproxy];
}

- (NSString *)getBundlePath {
    return [_air getIndexBundlePath] ;
}

- (NSString *)getFileContent:(NSString *)filePath {
    return [_air getFileContentAtPath:filePath];
}

- (NSString *)getReleaseConfig {
    return [_air getReleaseConfig];
}

@end


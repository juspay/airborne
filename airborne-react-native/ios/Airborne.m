
#import "Airborne.h"

@interface Airborne() <AirborneDelegate>

@property (nonatomic, strong) NSString* namespace;
@property (nonatomic, strong) AirborneServices* airborne;
@property (nonatomic, strong) NSString* releaseConfigURL;
@property (nonatomic, weak) id <AirborneDelegate> delegate;
@property (nonatomic, assign) BOOL shouldUpdateEnabled;

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
        self.releaseConfigURL = releaseConfigURL;
        self.delegate = delegate;
        self.shouldUpdateEnabled = shouldUpdate;
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
    if (!self.releaseConfigURL || self.releaseConfigURL.length == 0) {
        completion(@"{\"updateAvailable\":false,\"error\":\"No release config URL\"}");
        return;
    }

    NSURL *url = [NSURL URLWithString:self.releaseConfigURL];
    if (!url) {
        completion(@"{\"updateAvailable\":false,\"error\":\"Invalid release config URL\"}");
        return;
    }

    // Get local manifest for version comparison
    NSString *localRcJson = [self.airborne getReleaseConfig];
    NSData *localData = [localRcJson dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *localDict = localData ? [NSJSONSerialization JSONObjectWithData:localData options:0 error:nil] : nil;
    NSString *localVersion = localDict[@"config"][@"version"] ?: @"";
    NSString *localPkgVersion = localDict[@"package"][@"version"] ?: @"";

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    [request setHTTPMethod:@"GET"];
    [request setValue:@"no-cache" forHTTPHeaderField:@"cache-control"];
    [request setValue:localPkgVersion forHTTPHeaderField:@"x-package-version"];
    [request setValue:localVersion forHTTPHeaderField:@"x-config-version"];

#if TARGET_OS_IOS
    [request setValue:[[UIDevice currentDevice] systemVersion] forHTTPHeaderField:@"x-os-version"];
#endif

    // Add dimensions from delegate
    NSDictionary *dims = [(NSObject *)self.delegate respondsToSelector:@selector(dimensions)] ? [self.delegate dimensions] : nil;
    if (dims && dims.count > 0) {
        NSArray *sortedKeys = [[dims allKeys] sortedArrayUsingSelector:@selector(compare:)];
        NSMutableString *dimensionString = [NSMutableString string];
        for (NSString *key in sortedKeys) {
            if (dimensionString.length > 0) [dimensionString appendString:@";"];
            [dimensionString appendFormat:@"%@=%@", key, dims[key]];
        }
        [request setValue:dimensionString forHTTPHeaderField:@"x-dimension"];
    }

    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error) {
            NSDictionary *errResult = @{@"updateAvailable": @NO, @"error": error.localizedDescription ?: @""};
            NSData *errData = [NSJSONSerialization dataWithJSONObject:errResult options:0 error:nil];
            NSString *errJson = errData ? [[NSString alloc] initWithData:errData encoding:NSUTF8StringEncoding] : @"{\"updateAvailable\":false,\"error\":\"Unknown error\"}";
            completion(errJson);
            return;
        }

        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (httpResponse.statusCode != 200 || !data) {
            NSDictionary *errResult = @{@"updateAvailable": @NO, @"error": [NSString stringWithFormat:@"HTTP %ld", (long)httpResponse.statusCode]};
            NSData *errData = [NSJSONSerialization dataWithJSONObject:errResult options:0 error:nil];
            NSString *errJson = errData ? [[NSString alloc] initWithData:errData encoding:NSUTF8StringEncoding] : @"{\"updateAvailable\":false,\"error\":\"HTTP error\"}";
            completion(errJson);
            return;
        }

        NSDictionary *remoteDict = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        if (!remoteDict) {
            completion(@"{\"updateAvailable\":false,\"error\":\"Failed to parse release config\"}");
            return;
        }

        NSString *remoteVersion = remoteDict[@"config"][@"version"] ?: @"";
        NSString *remotePkgVersion = remoteDict[@"package"][@"version"] ?: @"";
        BOOL updateAvailable = ![remoteVersion isEqualToString:localVersion];

        NSDictionary *result = @{
            @"updateAvailable": @(updateAvailable),
            @"currentVersion": localVersion ?: @"",
            @"remoteVersion": remoteVersion,
            @"currentPackageVersion": localPkgVersion ?: @"",
            @"remotePackageVersion": remotePkgVersion
        };

        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
        NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        completion(jsonString ?: @"{\"updateAvailable\":false,\"error\":\"Failed to serialize result\"}");
    }];
    [task resume];
}

#pragma mark - AirborneDelegate

- (NSString *)namespace {
    return @"default";
}

@end


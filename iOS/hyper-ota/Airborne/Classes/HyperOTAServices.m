//
//  HyperOTAServices.m
//  HyperOTA
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "HyperOTAServices.h"
#import "HPJPApplicationManager.h"
#import "HPJPApplicationConstants.h"
#import <HyperCore/HPJPHelpers.h>

static NSString *DEFAULT_WORKSPACE = @"juspay";

@interface HyperOTAServices ()<HPJPApplicationManagerDelegate>

@property (nonatomic, strong) NSDictionary *payload;
@property (nonatomic, strong) NSBundle *baseBundle;
@property (nonatomic, strong) dispatch_semaphore_t semaphore;
@property (nonatomic, strong) HPJPApplicationManager *applicationManager;

@end

@implementation HyperOTAServices

- (instancetype)initWithPayload:(NSDictionary *)payload 
                loggerDelegate:(id<HPJPLoggerDelegate> _Nullable)logger 
                    baseBundle:(NSBundle * _Nullable)baseBundle {
    self = [super init];
    if (self) {
        _payload = payload;
        _baseBundle = baseBundle ?: [NSBundle mainBundle];
        _semaphore = dispatch_semaphore_create(0);
        [self initApplicationManagerWithLogger:logger];
    }
    return self;
}

- (instancetype)initWithClientId:(NSString *)clientId
                        delegate:(id<HPJPApplicationManagerDelegate>)delegate
                  loggerDelegate:(id<HPJPLoggerDelegate> _Nullable)logger {
    self = [super init];
    if (self) {
        _semaphore = dispatch_semaphore_create(0);
        [self initApplicationManagerWithClientId:clientId delegate:delegate logger:logger];
    }
    return self;
}

- (void)initApplicationManagerWithClientId:(NSString *)clientId delegate:(id<HPJPApplicationManagerDelegate>)delegate logger:(id<HPJPLoggerDelegate>)logger {
    self.applicationManager = [HPJPApplicationManager getSharedInstanceWithClientId:clientId workspace:DEFAULT_WORKSPACE delegate:delegate logger:logger];
    __weak HyperOTAServices *weakSelf = self;
    [self.applicationManager waitForPackagesAndResourcesWithCompletion:^(HPJPDownloadResult * _Nonnull result) {
        __strong HyperOTAServices *strongSelf = weakSelf;
        if (strongSelf) {
            dispatch_semaphore_signal(strongSelf.semaphore);
        }
    }];
}

- (void)initApplicationManagerWithLogger:(id<HPJPLoggerDelegate>)logger {
    NSString *clientId = self.payload[@"clientId"] ? [HPJPHelpers trimClientId:self.payload[@"clientId"]].lowercaseString : nil;
    NSString *namespace = self.payload[@"namespace"] ? [HPJPHelpers trimClientId:self.payload[@"namespace"]].lowercaseString : DEFAULT_WORKSPACE;
    NSString *workspace = [HPJPHelpers getWorkspaceForClientId:clientId tenantId:namespace];
    
    self.applicationManager = [HPJPApplicationManager getSharedInstanceWithClientId:clientId workspace:workspace delegate:self logger:logger];
    
    __weak HyperOTAServices *weakSelf = self;
    [self.applicationManager waitForPackagesAndResourcesWithCompletion:^(HPJPDownloadResult * _Nonnull result) {
        __strong HyperOTAServices *strongSelf = weakSelf;
        if (strongSelf) {
            dispatch_semaphore_signal(strongSelf.semaphore);
        }
    }];
}

- (NSURL *)bundleURL {
    BOOL forceUpdate = self.payload[@"forceUpdate"] != nil ? [self.payload[@"forceUpdate"] boolValue] : YES;
    BOOL localAssets = [self.payload[@"localAssets"] boolValue];
    if (forceUpdate && !localAssets && !self.applicationManager.isImportantPackageDownloadCompleted) {
        NSInteger timeoutValue = self.payload[@"updateTimeout"] ? [self.payload[@"updateTimeout"] integerValue] : -1; // Default is infinite.
        dispatch_time_t timeout = timeoutValue == -1 ? DISPATCH_TIME_FOREVER : dispatch_time(DISPATCH_TIME_NOW, timeoutValue * NSEC_PER_MSEC);
        dispatch_semaphore_wait(self.semaphore, timeout);
    }
    NSString *indexFileName = self.applicationManager.getCurrentApplicationManifest.package.index.filePath;
    NSString *bundleFileName = self.payload[@"fileName"] ?: indexFileName ?: @"main.jsbundle";
    if (!localAssets) {
        // Fetch the bundle file path
        NSString *bundleFilePath = [self.applicationManager getPathForPackageFile:bundleFileName];
        if ([[NSFileManager defaultManager] fileExistsAtPath:bundleFilePath]) {
            return [[NSURL alloc] initFileURLWithPath:bundleFilePath];
        }
    }
    // Fallback to provided base bundle resource
    NSString *fileName = [bundleFileName stringByDeletingPathExtension];
    NSString *fileExtension = [bundleFileName pathExtension];
    return [self.baseBundle URLForResource:fileName withExtension:fileExtension];
}

+ (NSURL *)bundleURL:(NSDictionary *)payload loggerDelegate:(id<HPJPLoggerDelegate> _Nullable)logger {
    HyperOTAServices *services = [[HyperOTAServices alloc] initWithPayload:payload loggerDelegate:logger baseBundle:[NSBundle mainBundle]];
    return [services bundleURL];
}

+ (NSURL *)bundleURL:(NSDictionary *)payload loggerDelegate:(id<HPJPLoggerDelegate> _Nullable)logger baseBundle:(NSBundle *_Nonnull)baseBundle {
    HyperOTAServices *services = [[HyperOTAServices alloc] initWithPayload:payload loggerDelegate:logger baseBundle:baseBundle];
    return [services bundleURL];
}

#pragma mark - ApplicationManager Delegate

- (NSString *)getReleaseConfigURL {
    return self.payload[@"releaseConfigURL"];
}

- (NSDictionary<NSString *,NSString *> *)getReleaseConfigHeaders {
    if (self.payload[@"releaseConfigHeaders"] && [self.payload[@"releaseConfigHeaders"] isKindOfClass:[NSDictionary<NSString *, NSString *> class]]) {
        return self.payload[@"releaseConfigHeaders"];
    }
    return @{};
}

- (BOOL)shouldDoForceUpdate {
    return self.payload[@"forceUpdate"] != nil ? [self.payload[@"forceUpdate"] boolValue] : YES;
}

- (BOOL)shouldUseLocalAssets {
    return [self.payload[@"localAssets"] boolValue];
}

@end

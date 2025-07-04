//
//  ApplicationManager.m
//  HyperCore
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "HPJPApplicationManager.h"
#import "HPJPApplicationManifest.h"
#import <WebKit/WebKit.h>
#import <HyperCore/HPJPFileUtil.h>
#import <HyperCore/HPJPHelpers.h>
#import <HyperCore/HPJPKeyValueStore.h>
#import "HPJPApplicationConstants.h"
#import "HPJPApplicationTracker.h"

typedef NS_ENUM(NSInteger, DownloadStatus) {
    DOWNLOADING,
    COMPLETED,
    FAILED
};

@implementation HPJPDownloadResult

- (instancetype) initWithManifest:(HPJPApplicationManifest* _Nonnull)releaseConfig result:(NSString* _Nonnull)result error:(NSString* _Nullable)error {
    self = [super init];
    if(self) {
        _releaseConfig = releaseConfig;
        _result = result;
        _error = error;
    }
    return self;
}

@end

static BOOL isFirstRunAfterInstallation = YES;
static BOOL isFirstRunAfterAppLaunch = YES;

static NSMutableDictionary<NSString*,HPJPApplicationManager*>* managers;

@interface HPJPApplicationManager() {
    BOOL _bootTimeoutOccurred;
    DownloadStatus _importantPackageDownloadStatus;
    DownloadStatus _lazyPackageDownloadStatus;
    DownloadStatus _resourceDownloadStatus;
    DownloadStatus _releaseConfigDownloadStatus;
    
    HPJPApplicationManifest* _downloadedApplicationManifest;
    MutableAppResources* _availableLazySplits;
    MutableAppResources* _availableResources;
    
    BOOL _callbacksFired;
}

@property (nonatomic, strong) id packageResourceObserver;
@property (nonatomic, copy) PackagesCompletionHandler packagesCompletionHandler;

@property (nonatomic, strong) NSLock *stateLock;
@property (nonatomic, strong) NSLock *collectionsLock;

@property (nonatomic, strong) NSString* managerId;
@property (nonatomic, strong) NSArray<HPJPLazyResource *>* currentLazy;
@property (nonatomic, strong) NSMutableArray<HPJPLazyResource *>* downloadedLazy;
@property (nonatomic, strong) HPJPApplicationResources* resources;
@property (nonatomic, strong) HPJPApplicationResources* tempResources;
@property (nonatomic, strong) HPJPApplicationConfig* config;
@property (nonatomic, strong) HPJPApplicationPackage* package;
@property (nonatomic, strong) NSString* releaseConfigError;
@property (nonatomic, strong) NSString* packageError;

@property (nonatomic) NSTimeInterval startTime;
@property (nonatomic, strong) NSString* workspace;
@property (nonatomic, strong) NSString* releaseConfigURL;
@property (nonatomic, strong) NSDictionary<NSString *, NSString *>* releaseConfigHeaders;
@property (nonatomic, strong) NSBundle* baseBundle;
@property (nonatomic) Boolean isLocalAssets;
@property (nonatomic) Boolean forceUpdate;

@property (nonatomic, weak) id<HPJPApplicationManagerDelegate> delegate;

@property (nonatomic, strong) HPJPApplicationTracker* tracker;
@property (nonatomic, strong) HPJPFileUtil* fileUtil;
@property (nonatomic, strong) HPJPRemoteFileUtil* remoteFileUtil;

@end

@implementation HPJPApplicationManager

#pragma mark - Initialiasation

- (instancetype)init {
    self = [super init];
    return self;
}


+ (instancetype)getSharedInstanceWithWorkspace:(NSString *)workspace delegate:(id<HPJPApplicationManagerDelegate> _Nonnull)delegate logger:(id<HPJPLoggerDelegate> _Nullable)logger {
    @synchronized ([HPJPApplicationManager class]) {
        if(managers == nil) {
            managers = [NSMutableDictionary dictionary];
        }
        HPJPApplicationManager* manager = managers[workspace];
        if (manager == nil || (manager.releaseConfigDownloadStatus == FAILED || manager.importantPackageDownloadStatus == FAILED || manager.importantPackageDownloadStatus == COMPLETED)) {
            manager = [[HPJPApplicationManager alloc] initWithWorkspace:workspace delegate:delegate logger:logger];
            managers[workspace] = manager;
        } else {
            [manager.tracker addLogger:logger];
        }

        return manager;
    }
}

- (instancetype)initWithWorkspace:(NSString *)workspace delegate:(id<HPJPApplicationManagerDelegate> _Nullable)delegate logger:(id<HPJPLoggerDelegate> _Nullable)logger {
    self = [super init];
    if (self) {
        self.workspace = workspace;
        self.delegate = delegate;
        
        self.releaseConfigURL = [delegate getReleaseConfigURL];
        
        if ([self.delegate respondsToSelector:@selector(getReleaseConfigHeaders)]) {
            self.releaseConfigHeaders = [self.delegate getReleaseConfigHeaders];
        } else {
            self.releaseConfigHeaders = @{};
        }
        
        if ([self.delegate respondsToSelector:@selector(getBaseBundle)]) {
            self.baseBundle = [self.delegate getBaseBundle];
        } else {
            self.baseBundle = [NSBundle mainBundle];
        }
        
        if ([self.delegate respondsToSelector:@selector(shouldUseLocalAssets)]) {
            self.isLocalAssets = [self.delegate shouldUseLocalAssets];
        } else {
            self.isLocalAssets = false;
        }
        
        if ([self.delegate respondsToSelector:@selector(shouldDoForceUpdate)]) {
            self.forceUpdate = [self.delegate shouldDoForceUpdate];
        } else {
            self.forceUpdate = true;
        }
        
        self.stateLock = [[NSLock alloc] init];
        self.collectionsLock = [[NSLock alloc] init];
        self.startTime = [[NSDate date] timeIntervalSince1970] * 1000;
        self.managerId = [[[NSUUID UUID] UUIDString] lowercaseString];
        self.tracker = [[HPJPApplicationTracker alloc] initWithManagerId:self.managerId workspace:workspace];
        [self.tracker addLogger:logger];
        [self initializeDefaults];
        if (self.isLocalAssets) {
            self.releaseConfigDownloadStatus = COMPLETED;
            self.resourceDownloadStatus = COMPLETED;
            self.importantPackageDownloadStatus = COMPLETED;
            self.lazyPackageDownloadStatus = COMPLETED;
            [self cleanUpUnwantedFiles];
        } else {
            dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
                [self startDownload];
            });
        }
    }
    return self;
}

- (void)initializeDefaults {
    HPJPNetworkClient* networkClient = [HPJPNetworkClient new];
    networkClient.logger = self.tracker;
    self.fileUtil = [[HPJPFileUtil alloc] initWithWorkspace:self.workspace baseBundle:self.baseBundle];
    self.remoteFileUtil = [[HPJPRemoteFileUtil alloc] initWithNetworkClient:networkClient];
    
    // Handle if any previously downloaded packages are available.
    [self handleTempPackageInstallation];
    
    self.package = [self readApplicationPackage];
    self.resources = [self readApplicationResources];
    
    // Handle if any previously downloaded resources are available.
    [self handleTempResourcesInstallation];
    
    self.config = [self readApplicationConfig];
    [self initializeLazyResourcesDownloadStatus];
    _availableLazySplits = [self dictionaryFromResources:self.package.lazy];
    _availableResources = [NSMutableDictionary dictionaryWithDictionary:self.resources.resources];
    [self.tracker trackInfo:@"init_with_local_config_versions" value:[@{@"package_version":self.package.version, @"config_version":self.config.version} mutableCopy]];
}

- (void)handleTempPackageInstallation {
    
    // Check if any app-pkg-temp.dat file is available in JuspayManifest.
    // If yes, a temporary package exists, which means an update was timedout.
    NSString *tempPackagePath = [self.fileUtil fullPathInStorageForFilePath:APP_PACKAGE_DATA_TEMP_FILE_NAME
                                                                       inFolder:JUSPAY_MANIFEST_DIR];
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if (![fileManager fileExistsAtPath:tempPackagePath]) {
        return;
    }
    
    
    NSError *error = nil;
    // Read temp package data
    HPJPApplicationPackage *tempPackage = (HPJPApplicationPackage*)[self.fileUtil getDecodedInstanceForClass:[HPJPApplicationPackage class]
                                                                                 withContentOfFileName:APP_PACKAGE_DATA_TEMP_FILE_NAME
                                                                                             inFolder:JUSPAY_MANIFEST_DIR
                                                                                                error:&error];
    
    if (tempPackage == nil) {
        // Failed to read temp package, clean up
        [self.tracker trackError:@"temp_package_read_failed" value:[@{@"error": error ? [error localizedDescription] : @"unknown error"} mutableCopy]];
        [self.fileUtil deleteFile:APP_PACKAGE_DATA_TEMP_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:nil];
        return;
    }
    
    // Move all files from temp to main
    NSArray *tempFiles = [self getAllFilesInDirectory:JUSPAY_PACKAGE_DIR subFolder:JUSPAY_TEMP_DIR includeSubfolders:YES];
    BOOL allMoveSuccessful = YES;
    
    [self.tracker trackInfo:@"temp_package_installation_started"
                      value:[@{@"count": @(tempFiles.count)} mutableCopy]];
    
    for (NSString *fileName in tempFiles) {
        NSError *moveError = nil;
        BOOL success = [self movePackageFromTempToMain:fileName error:&moveError];
        
        if (!success) {
            allMoveSuccessful = NO;
            [self.tracker trackError:@"file_move_failed" value:[@{
                @"file": fileName,
                @"error": moveError ? [moveError localizedDescription] : @"Unknown error"
            } mutableCopy]];
        }
    }
    
    // If files were moved successfully, update the package data
    if (allMoveSuccessful) {
        NSError *writeError = nil;
        BOOL didUpdate = [self.fileUtil writeInstanceToInternalStorage:tempPackage
                                                              fileName:APP_PACKAGE_DATA_FILE_NAME
                                                              inFolder:JUSPAY_MANIFEST_DIR
                                                                 error:&writeError];
        
        if (didUpdate) {
            [self.tracker trackInfo:@"temp_package_installed" value:[@{@"version": tempPackage.version} mutableCopy]];
        } else {
            [self.tracker trackError:@"temp_package_write_failed" value:[@{
                @"error": writeError ? [writeError localizedDescription] : @"Unknown error"
            } mutableCopy]];
        }
    }
    
    // Clean up the temp package file and directory
    [self.fileUtil deleteFile:APP_PACKAGE_DATA_TEMP_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:nil];
    [self cleanupTempDirectory];
}

- (void)handleTempResourcesInstallation {
    // Check if temp resources file exists
    NSString *tempResourcesPath = [self.fileUtil fullPathInStorageForFilePath:APP_TEMP_RESOURCES_DATA_FILE_NAME
                                                                      inFolder:JUSPAY_MANIFEST_DIR];
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if (![fileManager fileExistsAtPath:tempResourcesPath]) {
        return;
    }
    
    NSError *error = nil;
    // Read temp resources data
    HPJPApplicationResources *tempResources = (HPJPApplicationResources*)[self.fileUtil getDecodedInstanceForClass:[HPJPApplicationResources class]
                                                                                           withContentOfFileName:APP_TEMP_RESOURCES_DATA_FILE_NAME
                                                                                                       inFolder:JUSPAY_MANIFEST_DIR
                                                                                                          error:&error];
    
    if (tempResources == nil) {
        // Failed to read temp resources, clean up
        [self.tracker trackError:@"temp_resources_read_failed"
                           value:[@{@"error": error ? [error localizedDescription] : @"unknown error"} mutableCopy]];
        [self.fileUtil deleteFile:APP_TEMP_RESOURCES_DATA_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:nil];
        return;
    }
    
    [self.tracker trackInfo:@"temp_resources_installation_started"
                      value:[@{@"count": @(tempResources.resources.count)} mutableCopy]];
    
    // Move all temp resources to main and update available resources
    BOOL allMoveSuccessful = YES;
    NSMutableDictionary *updatedAvailableResources = [self.resources.resources mutableCopy];
    
    for (NSString *resourceKey in tempResources.resources) {
        HPJPResource *resource = tempResources.resources[resourceKey];
        
        // Move resource from JuspayResources to JuspayPackages/main
        [self moveResourceToMain:resource];
        
        // Update available resources
        updatedAvailableResources[resource.filePath] = resource;
    }
    
    if (allMoveSuccessful) {
        // Update the resources and save to disk
        self.resources.resources = updatedAvailableResources;
        [self updateResources:updatedAvailableResources];
        
        [self.tracker trackInfo:@"temp_resources_installed"
                          value:[@{@"count": @(tempResources.resources.count)} mutableCopy]];
    }
    
    // Clean up the temp resources file
    [self.fileUtil deleteFile:APP_TEMP_RESOURCES_DATA_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:nil];
}

- (void)initializeLazyResourcesDownloadStatus {
    NSString *storedPackagePath = [self.fileUtil fullPathInStorageForFilePath:APP_PACKAGE_DATA_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR];
    NSFileManager *fileManager = [NSFileManager defaultManager];
    isFirstRunAfterInstallation = ![fileManager fileExistsAtPath:storedPackagePath];
    
    // First, check if this is a bundle-loaded package (first run)
    if (self.package.lazy.count > 0 && ![fileManager fileExistsAtPath:storedPackagePath]) {
        
        NSMutableArray<HPJPLazyResource *> *updatedLazy = [NSMutableArray arrayWithArray:self.package.lazy];
        
        for (NSUInteger i = 0; i < updatedLazy.count; i++) {
            HPJPLazyResource *resource = updatedLazy[i];
            
            // For first run, all lazy packages in the bundle are assumed to be available
            resource.isDownloaded = YES;
        }
        
        self.package.lazy = updatedLazy;
        
        // Save the updated package to disk
        NSError *error = nil;
        BOOL didUpdate = [self.fileUtil writeInstanceToInternalStorage:self.package
                                                              fileName:APP_PACKAGE_DATA_FILE_NAME
                                                              inFolder:JUSPAY_MANIFEST_DIR
                                                                 error:&error];
        
        if (didUpdate) {
            [self.tracker trackInfo:@"lazy_resources_initialized" value:[@{@"count": @(updatedLazy.count)} mutableCopy]];
        } else {
            NSMutableDictionary<NSString*, id> *logVal = [NSMutableDictionary dictionary];
            logVal[@"error"] = error == nil ? @"reason unknown" : [error localizedDescription];
            [self.tracker trackError:@"lazy_resources_initialization_failed" value:logVal];
        }
    }
}

- (void)dealloc {
    // Clean up observer
    if (self.packageResourceObserver) {
        [[NSNotificationCenter defaultCenter] removeObserver:self.packageResourceObserver];
        self.packageResourceObserver = nil;
    }
}

#pragma mark - Thread-Safe Property Accessors

- (BOOL)isBootTimeoutOccurred {
    [self.stateLock lock];
    BOOL occurred = _bootTimeoutOccurred;
    [self.stateLock unlock];
    return occurred;
}

- (void)setBootTimeoutOccurred:(BOOL)bootTimeoutOccurred {
    [self.stateLock lock];
    _bootTimeoutOccurred = bootTimeoutOccurred;
    [self.stateLock unlock];
}

- (DownloadStatus)importantPackageDownloadStatus {
    [self.stateLock lock];
    DownloadStatus status = _importantPackageDownloadStatus;
    [self.stateLock unlock];
    return status;
}

- (void)setImportantPackageDownloadStatus:(DownloadStatus)importantPackageDownloadStatus {
    [self.stateLock lock];
    _importantPackageDownloadStatus = importantPackageDownloadStatus;
    [self.stateLock unlock];
}

- (DownloadStatus)lazyPackageDownloadStatus {
    [self.stateLock lock];
    DownloadStatus status = _lazyPackageDownloadStatus;
    [self.stateLock unlock];
    return status;
}

- (void)setLazyPackageDownloadStatus:(DownloadStatus)lazyPackageDownloadStatus {
    [self.stateLock lock];
    _lazyPackageDownloadStatus = lazyPackageDownloadStatus;
    [self.stateLock unlock];
}

- (DownloadStatus)resourcesDownloadStatus {
    [self.stateLock lock];
    DownloadStatus status = _resourceDownloadStatus;
    [self.stateLock unlock];
    return status;
}

- (void)setResourceDownloadStatus:(DownloadStatus)resourceDownloadStatus {
    [self.stateLock lock];
    _resourceDownloadStatus = resourceDownloadStatus;
    [self.stateLock unlock];
}

- (DownloadStatus)releaseConfigDownloadStatus {
    [self.stateLock lock];
    DownloadStatus status = _releaseConfigDownloadStatus;
    [self.stateLock unlock];
    return status;
}

- (void)setReleaseConfigDownloadStatus:(DownloadStatus)releaseConfigDownloadStatus {
    [self.stateLock lock];
    _releaseConfigDownloadStatus = releaseConfigDownloadStatus;
    [self.stateLock unlock];
}

#pragma mark - Thread-Safe Collection Access

- (HPJPApplicationManifest *)downloadedApplicationManifest {
    [self.collectionsLock lock];
    HPJPApplicationManifest *manifest = _downloadedApplicationManifest;
    [self.collectionsLock unlock];
    return manifest;
}

- (void)setDownloadedApplicationManifest:(HPJPApplicationManifest *)manifest {
    [self.collectionsLock lock];
    _downloadedApplicationManifest = manifest;
    [self.collectionsLock unlock];
}

- (void)updateAvailableLazySplit:(NSString *)filePath withResource:(HPJPResource *)resource {
    [self.collectionsLock lock];
    _availableLazySplits[filePath] = resource;
    [self.collectionsLock unlock];
}

- (HPJPResource *)availableLazySplit:(NSString *)filePath {
    [self.collectionsLock lock];
    HPJPResource *resource = _availableLazySplits[filePath];
    [self.collectionsLock unlock];
    return resource;
}

- (void)updateAvailableResource:(NSString *)filePath withResource:(HPJPResource *)resource {
    [self.collectionsLock lock];
    _availableResources[filePath] = resource;
    [self.collectionsLock unlock];
}

- (HPJPResource *)availableResource:(NSString *)filePath {
    [self.collectionsLock lock];
    HPJPResource *resource = _availableResources[filePath];
    [self.collectionsLock unlock];
    return resource;
}

- (MutableAppResources *)availableResources {
    [self.collectionsLock lock];
    MutableAppResources *resources = _availableResources;
    [self.collectionsLock unlock];
    return resources;
}

- (void)setAvailableResources:(MutableAppResources *)resources {
    [self.collectionsLock lock];
    _availableResources = resources;
    [self.collectionsLock unlock];
}

#pragma mark - Exposed

- (HPJPApplicationManifest *)getCurrentApplicationManifest {
    @synchronized(self) {
        return [[HPJPApplicationManifest alloc] initWithPackage:self.package config:self.config resources:self.resources];
    }
}

- (void)waitForPackagesAndResourcesWithCompletion:(void (^)(HPJPDownloadResult *result))completion {
    // Store the completion handler
    self.packagesCompletionHandler = completion;
    
    // If everything is already completed, call completion immediately
    if ([self isPackageAndResourceDownloadCompleted] && [self isReleaseConfigDownloadCompleted]) {
        completion([self getCurrentResult]);
        return;
    }
    
    // Set up observer only for package resource notification
    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    
    // Remove any existing observer first
    if (self.packageResourceObserver) {
        [center removeObserver:self.packageResourceObserver];
        self.packageResourceObserver = nil;
    }
    
    // Add observer for package completion
    __weak HPJPApplicationManager *weakSelf = self;
    self.packageResourceObserver = [center addObserverForName:PACKAGE_RESOURCE_NOTIFICATION
                                                       object:nil
                                                        queue:[NSOperationQueue new]
                                                   usingBlock:^(NSNotification * _Nonnull note) {
        __strong HPJPApplicationManager *strongSelf = weakSelf;
        if (strongSelf) {
            [strongSelf handlePackageResourceCompletion];
        }
    }];
}

- (HPJPDownloadResult*) getCurrentResult {
    HPJPApplicationManifest* manifest = [self getCurrentApplicationManifest];
    if(self.releaseConfigDownloadStatus == DOWNLOADING) {
        return [[HPJPDownloadResult alloc] initWithManifest:manifest result:@"RELEASE_CONFIG_TIMEDOUT" error:nil];
    } else if(self.releaseConfigDownloadStatus == FAILED) {
        return [[HPJPDownloadResult alloc] initWithManifest:manifest result:@"ERROR" error:[self sanitizedError:self.releaseConfigError]];
    } else if(self.importantPackageDownloadStatus == FAILED) {
        return [[HPJPDownloadResult alloc] initWithManifest:manifest result:@"PACKAGE_DOWNLOAD_FAILED" error:[self sanitizedError:self.packageError]];
    } else if(self.importantPackageDownloadStatus == DOWNLOADING) {
        return [[HPJPDownloadResult alloc] initWithManifest:manifest result:@"PACKAGE_TIMEDOUT" error:nil];
    }
    return [[HPJPDownloadResult alloc] initWithManifest:manifest result:@"OK" error:nil];
}

- (NSString *)readPackageFile:(NSString *)fileName {
    NSString *filePath = [JUSPAY_MAIN_DIR stringByAppendingPathComponent:fileName];
    NSError *fileLoadError = nil;
    NSString *fileContent = [self.fileUtil loadFile:filePath folder:JUSPAY_PACKAGE_DIR withLocalAssets:self.isLocalAssets error:&fileLoadError];
    
    if (fileLoadError) {
        [self.tracker trackError:@"read_package_file" value:[@{
            @"fileName": fileName ?: @"nil",
            @"error": fileLoadError.localizedDescription ?: @"unknown error"
        } mutableCopy]];
    }
    
    return fileContent;
}

- (NSString *)readResourceFile:(NSString *)resourceFileName {
    NSError *fileLoadError = nil;
    
    // Read from JuspayPackages/main (where available resources are stored)
    NSString *mainResourcePath = [JUSPAY_MAIN_DIR stringByAppendingPathComponent:resourceFileName];
    NSString *fileContent = [self.fileUtil loadFile:mainResourcePath folder:JUSPAY_PACKAGE_DIR withLocalAssets:self.isLocalAssets error:&fileLoadError];
    
    if (fileLoadError) {
        [self.tracker trackError:@"read_resource_file" value:[@{
            @"resourceName": resourceFileName,
            @"error": fileLoadError.localizedDescription ?: @"unknown error"
        } mutableCopy]];
    }
    
    return fileContent;
}

- (NSNumber *)getReleaseConfigTimeout {
    return self.config.releaseConfigTimeout;
}

- (NSNumber *)getPackageTimeout {
    if (self.downloadedApplicationManifest != nil) {
        return self.downloadedApplicationManifest.config.bootTimeout;
    }
    return self.config.bootTimeout;
}

- (BOOL)isPackageAndResourceDownloadCompleted {
    // Only important packages and resources need to be completed for app to start
    return [self isDownloadCompleted:self.importantPackageDownloadStatus] &&
           [self isDownloadCompleted:self.resourcesDownloadStatus];
}

- (BOOL)isReleaseConfigDownloadCompleted {
    return [self isDownloadCompleted:self.releaseConfigDownloadStatus];
}

- (BOOL)isImportantPackageDownloadCompleted {
    return [self isDownloadCompleted:self.importantPackageDownloadStatus];
}

- (BOOL)isLazyPackageDownloadCompleted {
    return [self isDownloadCompleted:self.lazyPackageDownloadStatus];
}

- (BOOL)isResourcesDownloadCompleted {
    return [self isDownloadCompleted:self.resourcesDownloadStatus];
}

- (NSString *)getPathForPackageFile:(NSString *)fileName {
    NSString *filePath = [JUSPAY_MAIN_DIR stringByAppendingPathComponent:fileName];
    return [self.fileUtil fullPathInStorageForFilePath:filePath inFolder:JUSPAY_PACKAGE_DIR];
}

- (void)startDownload {
    self.releaseConfigDownloadStatus = DOWNLOADING;
    self.importantPackageDownloadStatus = DOWNLOADING;
    self.lazyPackageDownloadStatus = DOWNLOADING;
    self.resourceDownloadStatus = DOWNLOADING;
    [self fetchReleaseConfigWithCompletionHandler:^(HPJPApplicationManifest* manifest,NSError* error) {
        if (error==nil && manifest != nil) {
            self.downloadedApplicationManifest = manifest;
            self.releaseConfigDownloadStatus = COMPLETED;
            [self cleanUpUnwantedFiles];
            [self updateConfig:manifest.config];
            [self tryDownloadingUpdate];
        } else {
            self.releaseConfigDownloadStatus = FAILED;
            self.releaseConfigError = [self sanitizedError:error.localizedDescription];
            self.resourceDownloadStatus = COMPLETED;
            self.importantPackageDownloadStatus = COMPLETED;
            self.lazyPackageDownloadStatus = COMPLETED;
            [self cleanUpUnwantedFiles];
            [self fireCallbacks];
        }
        [[NSNotificationCenter defaultCenter] postNotificationName:RELEASE_CONFIG_NOTIFICATION
                                                            object:nil
                                                          userInfo:@{}];
    }];
}

- (void)tryDownloadingUpdate {
    if (self.downloadedApplicationManifest == nil) {
        return;
    }

    // Download important packages first
    if (!([self.package.version isEqualToString: self.downloadedApplicationManifest.package.version] &&
         [self.package.name isEqualToString:self.downloadedApplicationManifest.package.name])) {
        
        [self startBootTimeoutTimer];
        
        self.currentLazy = [self.package.lazy copy];
        self.downloadedLazy = [self.downloadedApplicationManifest.package.lazy mutableCopy];
        
        __weak HPJPApplicationManager* weakSelf = self;
        
        [self downloadImportantPackagesWithNewManifest:self.downloadedApplicationManifest.package currentManifest:self.package onCompletion:^(BOOL downloadFailed, BOOL timedOut) {
            if (weakSelf) {
                __strong HPJPApplicationManager* strongSelf = weakSelf;
                if (!downloadFailed) { // Important packages downloaded successfully/No updates.
                    [strongSelf didFinishImportantPackageWithLazyDownloadComplete:timedOut];
                    
                    // Start lazy packages download.
                    NSArray<HPJPResource *> *toDownload = [self getResourcesFrom:strongSelf.downloadedLazy filtering:strongSelf.currentLazy];
                    NSString *packageVersion = timedOut ? strongSelf.downloadedApplicationManifest.package.version : strongSelf.package.version;
                    [strongSelf downloadLazyPackageResources:toDownload version:packageVersion singleDownloadHandler:^(BOOL status, HPJPResource *resource) {
                        if (!weakSelf) {
                            return;
                        }
                        __strong HPJPApplicationManager* strongSelf = weakSelf;
                        
                        if (timedOut) {
                            if (!status) {
                                return;
                            }
                            
                            for (NSUInteger i = 0; i < strongSelf.downloadedLazy.count; i++) {
                                HPJPLazyResource *lazyResource = strongSelf.downloadedLazy[i];
                                if ([lazyResource.filePath isEqualToString:resource.filePath]) {
                                    lazyResource.isDownloaded = status;
                                    strongSelf.downloadedLazy[i] = lazyResource;
                                    break;
                                }
                            }
                            return;
                        }
                        
                        if (status) { // Download success
                            // Move downloaded lazy package to main.
                            HPJPLazyResource *lazyResource = (HPJPLazyResource *)resource;
                            [strongSelf moveLazyPackageFromTempToMain:lazyResource];
                        }
                        [[NSNotificationCenter defaultCenter] postNotificationName:LAZY_PACKAGE_NOTIFICATION object:nil userInfo:@{@"lazyDownloadsComplete": @NO, @"downloadStatus": @(status), @"url": resource.url, @"filePath": resource.filePath}];
                    } downloadCompletion:^{
                        if (!weakSelf) {
                            return;
                        }
                        __strong HPJPApplicationManager* strongSelf = weakSelf;
                        
                        if (timedOut) {
                            strongSelf.downloadedApplicationManifest.package.lazy = strongSelf.downloadedLazy;
                            [strongSelf updatePackageInTemp:strongSelf.downloadedApplicationManifest.package];
                            
                            return;
                        }
                        
                        [[NSNotificationCenter defaultCenter] postNotificationName:LAZY_PACKAGE_NOTIFICATION object:nil userInfo:@{@"lazyDownloadsComplete": @YES}];
                    }];
                } else {
                    // Don't download lazy pacakge if important pacakge download failed.
                    [strongSelf didFinishImportantPackageWithLazyDownloadComplete:YES];
                }
            }
        }];
    } else {
        [self.tracker trackInfo:@"package_update_info" value:[@{@"package_splits_download" : @"No updates in app"} mutableCopy]];
        [self didFinishImportantPackageWithLazyDownloadComplete:YES];
        
        // Check for failed lazy downloads even if package versions are the same
        [self retryFailedLazyDownloads];
    }

    // Download resources in parallel
    __weak HPJPApplicationManager* weakSelf = self;
    [self downloadResourcesWithCurrentResources:self.resources.resources
                                   newResources:self.downloadedApplicationManifest.resources.resources
                          singleDownloadHandler:^(NSString* key, HPJPResource* value) {
        __strong HPJPApplicationManager* strongSelf = weakSelf;
        if (strongSelf) {
            [strongSelf.tracker trackInfo:@"resource_download_completed" value:[@{@"resource" : key} mutableCopy]];
        }
    } downloadCompletion:^ {
        __strong HPJPApplicationManager* strongSelf = weakSelf;
        if(strongSelf) {
            strongSelf.resourceDownloadStatus = COMPLETED;
            [strongSelf fireCallbacks];
        }
    }];
}

- (void)startBootTimeoutTimer {
    
    __weak HPJPApplicationManager* weakSelf = self;
    NSNumber *bootTimeout = [self getPackageTimeout];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)([bootTimeout intValue] * NSEC_PER_MSEC)),
                   dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        HPJPApplicationManager *strongSelf = weakSelf;
        if (strongSelf == nil) {
            return;
        }
        
        strongSelf.bootTimeoutOccurred = true;
        [[NSNotificationCenter defaultCenter] postNotificationName:BOOT_TIMEOUT_NOTIFICATION
                                                                        object:nil
                                                                      userInfo:@{}];

        [strongSelf handlePackageResourceCompletion];
    });
}

- (void)cleanUpUnwantedFiles {
    if(isFirstRunAfterAppLaunch) {
        isFirstRunAfterAppLaunch = NO;
        
        // Get all files in the package directory
        NSArray *allPackageFiles = [self getAllFilesInDirectory:JUSPAY_PACKAGE_DIR subFolder:JUSPAY_MAIN_DIR includeSubfolders:YES];
        NSMutableSet<NSString *> *requiredFiles = [NSMutableSet set];
        
        // Add files from current package
        if (self.package) {
            for (HPJPResource *resource in [self.package allSplits]) {
                NSString *fileName = [self jsFileNameFor:resource.filePath];
                [requiredFiles addObject:fileName];
            }
        }
        
        // Add files from downloaded package if available
        if (self.downloadedApplicationManifest && self.downloadedApplicationManifest.package) {
            for (HPJPResource *resource in [self.downloadedApplicationManifest.package allSplits]) {
                NSString *fileName = [self jsFileNameFor:resource.filePath];
                [requiredFiles addObject:fileName];
            }
        }
        
        // Add files from current resources
        NSDictionary<NSString*, HPJPResource*> *resourcesData = self.resources.resources;
        for (NSString* resourceName in resourcesData) {
            HPJPResource* resource = resourcesData[resourceName];
            NSString* fileNameOnDisk = [self jsFileNameFor:resource.filePath];
            [requiredFiles addObject:fileNameOnDisk];
        }
        
        // Loop through the files and delete those not associated with required versions
        for (NSString *fileName in allPackageFiles) {
            BOOL shouldKeep = [requiredFiles containsObject:fileName];
            
            // Delete file if it doesn't belong to a required version
            if (!shouldKeep) {
                [self.tracker trackInfo:@"cleaning_unused_file" value:[@{@"file": fileName} mutableCopy]];
                [self deleteFile:fileName subFolder:JUSPAY_MAIN_DIR inFolder:JUSPAY_PACKAGE_DIR];
            }
        }

        // cleanup of temp resources
        NSArray<NSString*> *resourceFileNames = [self getAllFilesInDirectory:JUSPAY_RESOURCE_DIR subFolder:@"" includeSubfolders:YES];
        for (NSString* fileName in resourceFileNames) {
            [self deleteFile:fileName subFolder:@"" inFolder:JUSPAY_RESOURCE_DIR];
        }
    }
}

- (void)handlePackageResourceCompletion {
    void (^handler)(HPJPDownloadResult *) = nil;
    
    @synchronized(self) {
        if (self.packagesCompletionHandler) {
            handler = self.packagesCompletionHandler;
            self.packagesCompletionHandler = nil;
            
            if (self.packageResourceObserver) {
                [[NSNotificationCenter defaultCenter] removeObserver:self.packageResourceObserver];
                self.packageResourceObserver = nil;
            }
        }
    }
    
    if (handler) {
        handler([self getCurrentResult]);
    }
}

# pragma mark - Manifest

- (NSInteger)generateNewToss:(double) currentTime {
    NSInteger tossValue = arc4random_uniform(100);
    NSDictionary *newTimedToss = @{
        @"ts": @(currentTime),
        @"toss": @(tossValue)
    };
    NSError *error = nil;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:newTimedToss options:0 error:&error];
    if (jsonData != nil) {
        NSString *newTossString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        [HPJPKeyValueStore setValue:newTossString forKey:PATCH_TOSS workspace:self.workspace];
    }
    return tossValue;
}

- (NSInteger)getTimedToss {
    NSString *tossString = [HPJPKeyValueStore getValueForKey:PATCH_TOSS workspace:self.workspace];
    double currentTime = round([[NSDate date] timeIntervalSince1970]);
    if (tossString != nil) {
        NSData *data = [tossString dataUsingEncoding:NSUTF8StringEncoding];
        NSError *error = nil;
        NSDictionary *tossHolder = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
        if (error != nil) {
            return [self generateNewToss:currentTime];
        }
        double tossedTime = [tossHolder[@"ts"] doubleValue];
        // Check if the toss has expired
        if (currentTime - tossedTime > TOSS_TIMEOUT) {
            return [self generateNewToss:currentTime];
        } else {
            return [tossHolder[@"toss"] integerValue];
        }
    } else {
        return [self generateNewToss:currentTime];
    }
}

- (void)fetchReleaseConfigWithCompletionHandler:(HPJPReleaseConfigCompletionHandler)completionHandler {
        
    NSURL *manifestUrl = [NSURL URLWithString:self.releaseConfigURL];
    
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:manifestUrl];
    [request setHTTPMethod:@"GET"];
    // Add headers
    NSDictionary *networkInfo = [HPJPHelpers connectedNetworkType];
    [request setValue:networkInfo[@"network_info"] forHTTPHeaderField: @"x-network-type"];
    [request setValue:[[UIDevice currentDevice] systemVersion] forHTTPHeaderField: @"x-os-version"];
    [request setValue:self.package.version forHTTPHeaderField: @"x-package-version"];
    [request setValue:self.config.version forHTTPHeaderField: @"x-config-version"];
    
    for (NSString *field in self.releaseConfigHeaders) {
        [request setValue:self.releaseConfigHeaders[field] forHTTPHeaderField:field];
    }

    NSURLSession *session = [NSURLSession sharedSession];
    NSTimeInterval startTime = [[NSDate date] timeIntervalSince1970] * 1000;
    NSURLSessionDataTask* manifestDataTask = [session dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {

        NSInteger statusCode = [self getResponseCodeFromNSURLResponse:response];
        NSMutableDictionary<NSString*,id>* logData = [NSMutableDictionary dictionary];
        logData[@"release_config_url"] = self.releaseConfigURL;
        logData[@"status"] = [NSNumber numberWithFloat:statusCode];
        logData[@"time_taken"] = [NSNumber numberWithDouble:(([[NSDate date] timeIntervalSince1970] * 1000) - startTime)];

        if (error) {
            logData[@"error"] = [error localizedDescription];
            logData[@"is_success"] = @NO;
            [self.tracker trackInfo:@"release_config_fetch" value:logData];
            completionHandler(nil,error);
            return;
        }

        if (data) {
            HPJPApplicationManifest* manifest = [[HPJPApplicationManifest alloc] initWithData:data error:&error]; //
            logData[@"is_success"] = @YES;
            if(error != nil) {
                logData[@"is_success"] = @NO;
                logData[@"error"] = [error localizedDescription];
                logData[@"mesage"] = @"Failed to parse release config";
            }
            if (error == nil && manifest != nil) {
                logData[@"new_rc_version"] = manifest.config.version;
            }
            [self.tracker trackInfo:@"release_config_fetch" value:logData];
            completionHandler(manifest,error);
        } else {
            logData[@"is_success"] = @NO;
            logData[@"error"] = @"no data found";
            [self.tracker trackInfo:@"release_config_fetch" value:logData];
            completionHandler(nil,nil);
        }
    }];

    [manifestDataTask resume];
}

# pragma mark - Config

- (HPJPApplicationConfig *)readApplicationConfig {
    NSError *err = nil;
    HPJPApplicationConfig* config = (HPJPApplicationConfig*)[self.fileUtil getDecodedInstanceForClass:[HPJPApplicationConfig class] withContentOfFileName:APP_CONFIG_DATA_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:&err];
    if (config != nil) {
        return config;
    }
    NSError* newErr = nil;
    config = [[HPJPApplicationConfig alloc] initWithError:&newErr fileUtil:self.fileUtil];
    if(config == nil || newErr!=nil) {
        NSMutableDictionary* logVal = [NSMutableDictionary dictionary];
        logVal[@"error"] = newErr == nil ? @"reason unknown":[newErr localizedDescription];
        logVal[@"file_name"] = @"config.json";
        [self.tracker trackError:@"release_config_read_failed" value:logVal];
    }

    return config;
}

- (void)updateConfig:(HPJPApplicationConfig *)config {
    if(![config.version isEqualToString:self.config.version]) {
        NSError *error = nil;
        BOOL didUpdate = [self.fileUtil writeInstanceToInternalStorage:config fileName:APP_CONFIG_DATA_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:&error];
        if(didUpdate) {
            @synchronized(self) {
                self.config = config;
            }
            NSMutableDictionary<NSString*,id>* logData = [NSMutableDictionary dictionary];
            logData[@"new_config_version"] = config.version;
            [self.tracker trackInfo:@"config_updated" value:logData];
        } else  {
            NSMutableDictionary<NSString*, id> *logVal = [NSMutableDictionary dictionary];
            logVal[@"error"] = error == nil ?  @"Reason unknown": [error localizedDescription];
            [self.tracker trackError:@"release_config_write_failed" value:logVal];
        }
    }
}

# pragma mark - Package

- (HPJPApplicationPackage *)readApplicationPackage {
    NSError* err = nil;
    HPJPApplicationPackage* package =  (HPJPApplicationPackage*)[self.fileUtil getDecodedInstanceForClass:[HPJPApplicationPackage class] withContentOfFileName:APP_PACKAGE_DATA_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:&err];
    if(package != nil) {
        return package;
    }
    NSError* newErr = nil;
    package = [[HPJPApplicationPackage alloc] initWithFileUtil:self.fileUtil error:&newErr];
    if (package == nil || newErr != nil) {
        NSMutableDictionary* logVal = [NSMutableDictionary dictionary];
        logVal[@"error"] = newErr == nil ? @"reason unknown":[newErr localizedDescription];
        logVal[@"file_name"] = @"package.json";
        [self.tracker trackError:@"release_config_read_failed" value:logVal];
    }

    return package;
}

- (void)downloadImportantPackagesWithNewManifest:(HPJPApplicationPackage *)newManifest
                                 currentManifest:(HPJPApplicationPackage *)currentManifest
                                    onCompletion:(void (^)(BOOL, BOOL))completion {
    NSTimeInterval startTime = [[NSDate date] timeIntervalSince1970] * 1000;
    
    NSLock *downloadLock = [[NSLock alloc] init];
    __block BOOL timeoutOccurred = NO;
    __block BOOL allDownloadsComplete = NO;
    
    // Set up boot timeout handler
    __weak HPJPApplicationManager* weakSelf = self;
    __block id timeoutObserver = [NSNotificationCenter.defaultCenter addObserverForName:BOOT_TIMEOUT_NOTIFICATION
                                                       object:nil
                                                        queue:[NSOperationQueue new]
                                                   usingBlock:^(NSNotification * _Nonnull note) {
        // Handle boot timeout
        __strong HPJPApplicationManager* strongSelf = weakSelf;
        if (strongSelf) {
            [downloadLock lock];
            if (!allDownloadsComplete) {
                timeoutOccurred = YES;
                // Boot timeout occurred before all downloads completed
                // Mark as completed - downloads will continue in background
                [strongSelf.tracker trackInfo:@"important_package_update_result"
                                        value:[@{@"result": @"TIMEOUT",
                                                 @"boot_timeout": [self getPackageTimeout],
                                                 @"importantPackageDownloadCompleted": @([strongSelf isImportantPackageDownloadCompleted]),
                                                 @"resourcesDownloadCompleted": @([strongSelf isResourcesDownloadCompleted]),
                                                 @"time_taken": @([[NSDate date] timeIntervalSince1970] * 1000 - startTime)} mutableCopy]];
                strongSelf.importantPackageDownloadStatus = COMPLETED;
                strongSelf.resourceDownloadStatus = COMPLETED;
            }
            [downloadLock unlock];
        }
    }];
    
    // Clean and prepare temp directory
    [self prepareTempDirectory];
    
    // Get packages to download
    NSArray<HPJPResource *> *currentSplits = [currentManifest allImportantSplits];
    NSArray<HPJPResource *> *newSplits = [newManifest allImportantSplits];
    NSArray<HPJPResource *> *toDownload = [self getResourcesFrom:newSplits filtering:currentSplits];
    
    [self.tracker trackInfo:@"important_package_download_started"
              value:[@{@"package_version": newManifest.version} mutableCopy]];
    NSTimeInterval packageStartTime = [[NSDate date] timeIntervalSince1970] * 1000;
    
    if (toDownload.count == 0) {
        // No new packages to download
        [self.tracker trackInfo:@"package_update_info"
                  value:[@{@"important_splits_download": @"No new important splits available"} mutableCopy]];
        [self updatePackage:newManifest didDownloadImportant:NO startTime:packageStartTime];
        
        [NSNotificationCenter.defaultCenter removeObserver:timeoutObserver];
        
        // Not Failed, Not Timedout
        completion(NO, NO);
        return;
    }
    
    // Set up download tracking variables
    NSMutableSet *pendingDownloads = [NSMutableSet setWithArray:[toDownload valueForKey:@"filePath"]];
    NSMutableSet *failedDownloads = [NSMutableSet set];
    
    // Start downloads to temp directory
    dispatch_group_t group = dispatch_group_create();
    
    for (HPJPResource *split in toDownload) {
        dispatch_group_enter(group);
        dispatch_group_async(group, dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
            if (weakSelf != nil) {
                __strong HPJPApplicationManager* strongSelf = weakSelf;
                
                // Get filename without path for saving to temp
                NSString *fileName = [[split.url pathExtension] isEqualToString:@"zip"] ? split.url.lastPathComponent : split.filePath;
                NSString *tempPath = [JUSPAY_TEMP_DIR stringByAppendingPathComponent:fileName];
                
                [strongSelf downloadFileFromURL:split.url
                          andSaveInFilePath:tempPath
                                    inFolder:JUSPAY_PACKAGE_DIR
                           completionHandler:^(NSError *error) {
                    if (weakSelf) {
                        __strong HPJPApplicationManager* strongSelf = weakSelf;
                        [downloadLock lock];
                        
                        // Update download tracking
                        [pendingDownloads removeObject:split.filePath];
                        
                        if (error) {
                            // Track failed downloads
                            [failedDownloads addObject:split.filePath];
                            [strongSelf.tracker trackError:@"important_package_download_error"
                                          value:[@{@"file": split.filePath,
                                                  @"error": [error localizedDescription]} mutableCopy]];
                        }
                        
                        [downloadLock unlock];
                    }
                    dispatch_group_leave(group);
                }];
            } else {
                dispatch_group_leave(group);
            }
        });
    }
    
    // When all downloads complete
    dispatch_group_notify(group, dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        __strong HPJPApplicationManager* strongSelf = weakSelf;
        if (strongSelf) {
            [downloadLock lock];
            
            // All downloads complete (regardless of whether timeout occurred)
            allDownloadsComplete = YES;
            
            // No timeout occurred - normal flow
            if (failedDownloads.count > 0) {
                // Some downloads failed
                strongSelf.importantPackageDownloadStatus = FAILED;
                strongSelf.packageError = [NSString stringWithFormat:@"Failed to download packages: %@", [failedDownloads allObjects]];
                [strongSelf.tracker trackError:@"important_package_download_result"
                               value:[@{@"result": @"FAILED",
                                        @"reason": @"important",
                                        @"error": strongSelf.packageError,
                                        @"timeout": @(timeoutOccurred)} mutableCopy]];
                
                // Clean up temp directory - files are not usable
                [strongSelf cleanupTempDirectory];
                
                // Failed, Timeout
                completion(YES, timeoutOccurred);
            } else if (timeoutOccurred || strongSelf.forceUpdate == false) {
                // Timeout occurred or force update is false - never move to main, leave files in temp
                [strongSelf.tracker trackInfo:@"downloads_completed_after_timeout"
                                        value:[@{@"timeoutOccurred": @(timeoutOccurred),
                                                 @"forceUpdate": @(strongSelf.forceUpdate),
                                                 @"failed_downloads": [failedDownloads allObjects],
                                                 @"all_successful": @(failedDownloads.count == 0),
                                                 @"time_taken": @([[NSDate date] timeIntervalSince1970] * 1000 - startTime)} mutableCopy]];
                
                // Not Failed, Timedout
                completion(NO, YES);
            } else {
                // All downloads successful before timeout, move everything from temp to main
                [strongSelf.tracker trackInfo:@"important_package_download_result"
                              value:[@{@"result": @"SUCCESS",
                                       @"reason": @"important",
                                       @"boot_timeout": [self getPackageTimeout],
                                       @"time_taken": @([[NSDate date] timeIntervalSince1970] * 1000 - startTime)} mutableCopy]];

                [strongSelf moveAllPackagesFromTempToMain];
                strongSelf.importantPackageDownloadStatus = COMPLETED;
                [strongSelf updatePackage:newManifest didDownloadImportant:YES startTime:startTime];
                [strongSelf.tracker trackInfo:@"important_package_update_result"
                              value:[@{@"result": @"SUCCESS",
                                       @"boot_timeout": [self getPackageTimeout],
                                       @"time_taken": @([[NSDate date] timeIntervalSince1970] * 1000 - startTime)} mutableCopy]];
                
                // Not failed, Not timedout
                completion(NO, NO);
            }
            
            [NSNotificationCenter.defaultCenter removeObserver:timeoutObserver];
            
            [downloadLock unlock];
        }
    });
}

- (void)moveAllPackagesFromTempToMain {
    NSString *tempDirPath = [self.fileUtil fullPathInStorageForFilePath:JUSPAY_TEMP_DIR
                                                             inFolder:JUSPAY_PACKAGE_DIR];
    
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSError *error = nil;
    NSArray *tempFiles = [fileManager contentsOfDirectoryAtPath:tempDirPath error:&error];
    
    if (error) {
        [self.tracker trackError:@"temp_directory_read_failed"
                  value:[@{@"error": [error localizedDescription]} mutableCopy]];
        return;
    }
    
    // Move all files from temp to main
    for (NSString *fileName in tempFiles) {
        NSError *moveError;
        BOOL success = [self movePackageFromTempToMain:fileName error:&moveError];
        if (!success) {
            [self.tracker trackError:@"file_move_failed"
                      value:[@{@"file": fileName,
                              @"error": moveError ? [moveError localizedDescription] : @"Unknown error"}
                            mutableCopy]];
        } else {
            [self.tracker trackInfo:@"file_moved_to_main"
                      value:[@{@"file": fileName} mutableCopy]];
        }
    }
}

- (BOOL)movePackageFromTempToMain:(NSString *)fileName error:(NSError **)error {
    NSString *tempFilePath = [NSString stringWithFormat:@"%@/%@", JUSPAY_TEMP_DIR, fileName];
    NSString *mainFilePath = [NSString stringWithFormat:@"%@/%@", JUSPAY_MAIN_DIR, fileName];

    NSString *tempPath = [self.fileUtil fullPathInStorageForFilePath:tempFilePath inFolder:JUSPAY_PACKAGE_DIR];
    NSString *mainPath = [self.fileUtil fullPathInStorageForFilePath:mainFilePath inFolder:JUSPAY_PACKAGE_DIR];

    NSFileManager *fileManager = [NSFileManager defaultManager];
    if ([fileManager fileExistsAtPath:mainPath]) {
        // File already exists - remove it first
        [fileManager removeItemAtPath:mainPath error:error];
        if (error && *error) {
            return NO;
        }
    }
    
    // Move the file from temp to main
    BOOL status = [[NSFileManager defaultManager] moveItemAtPath:tempPath toPath:mainPath error:error];
    return status;
}

- (void)moveLazyPackageFromTempToMain:(HPJPLazyResource *)resource {
    // Move downloaded lazy package to main.
    NSString *fileName = resource.filePath;
    NSError *moveError;
    BOOL success = [self movePackageFromTempToMain:fileName error:&moveError];
    
    if (!success) {
        [self.tracker trackError:@"lazy_package_move_failed" value:[@{
            @"file": fileName,
            @"error": moveError ? [moveError localizedDescription] : @"Unknown error"
        } mutableCopy]];
    } else {
        [self updateAvailableResource:resource.filePath withResource:resource];
        [self updateLazyPackageDownloadStatus:resource withStatus:YES];
    }
}

- (void)downloadLazyPackageResources:(NSArray<HPJPResource *> *)resourcesToDownload version:(NSString *)version singleDownloadHandler:(void (^)(BOOL, HPJPResource*))singleDownloadHandler downloadCompletion:(void (^)(void))downloadCompletion {
    NSTimeInterval startTime = [[NSDate date] timeIntervalSince1970] * 1000;
    
    if (resourcesToDownload.count == 0) {
        [self.tracker trackInfo:@"package_update_info" value:[@{@"lazy_splits_download" : @"No new lazy splits available"} mutableCopy]];
        self.lazyPackageDownloadStatus = COMPLETED;
        downloadCompletion();
        return;
    }
    [self.tracker trackInfo:@"lazy_package_download_started" value:[@{@"package_version" : version} mutableCopy]];

    dispatch_group_t group = dispatch_group_create();
    __weak HPJPApplicationManager* weakSelf = self;
    
    for (HPJPResource *split in resourcesToDownload) {
        dispatch_group_enter(group);
        dispatch_group_async(group, dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
            __strong HPJPApplicationManager* strongSelf = weakSelf;
            if (strongSelf != nil) {
                NSString *tempFilePath = [NSString stringWithFormat:@"%@/%@", JUSPAY_TEMP_DIR, split.filePath];
                [strongSelf downloadFileFromURL:split.url andSaveInFilePath:tempFilePath inFolder:JUSPAY_PACKAGE_DIR completionHandler:^(NSError *error) {
                    if (error != nil) {
                        [strongSelf.tracker trackError:@"lazy_package_download_error" value:[@{@"url": [split.url absoluteString], @"error": [error localizedDescription]} mutableCopy]];
                        strongSelf.packageError = [NSString stringWithFormat:@"Failed to download lazy package: %@", [error localizedDescription]];
                        [strongSelf.tracker trackError:@"lazy_package_download_result"
                               value:[@{@"result": @"FAILED",
                                        @"reason": @"lazy",
                                        @"time_taken":[NSNumber numberWithDouble:(([[NSDate date] timeIntervalSince1970] * 1000) - startTime)],
                                        @"error": strongSelf.packageError} mutableCopy]];
                    }
                    singleDownloadHandler(error == nil, split);
                    dispatch_group_leave(group);
                }];
            } else {
                singleDownloadHandler(NO, split);
                dispatch_group_leave(group); // Ensure group leave on weakSelf nil
            }
        });
    }
    
    dispatch_group_notify(group, dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        __strong HPJPApplicationManager* strongSelf = weakSelf;
        if (strongSelf) {
            strongSelf.lazyPackageDownloadStatus = COMPLETED;
            [strongSelf.tracker trackInfo:@"lazy_package_download_result"
                               value:[@{@"result": @"SUCCESS",
                                        @"reason": @"lazy",
                                        @"time_taken":[NSNumber numberWithDouble:(([[NSDate date] timeIntervalSince1970] * 1000) - startTime)]} mutableCopy]];
            downloadCompletion();
        }
    });
}

- (void)retryFailedLazyDownloads {
    NSMutableArray<HPJPLazyResource *> *failedDownloads = [NSMutableArray array];
    
    // Find all lazy resources that are marked as not downloaded
    @synchronized(self.package) {
        for (HPJPLazyResource *resource in self.package.lazy) {
            if (!resource.isDownloaded) {
                [failedDownloads addObject:resource];
            }
        }
    }
    
    if (failedDownloads.count > 0) {
        [self.tracker trackInfo:@"retrying_failed_lazy_downloads" value:[@{@"count": @(failedDownloads.count)} mutableCopy]];
        
        __weak HPJPApplicationManager *weakSelf = self;
        // Download the failed lazy resources
        [self downloadLazyPackageResources:failedDownloads version:self.package.version singleDownloadHandler:^(BOOL status, HPJPResource *resource) {
            if (status && [resource isKindOfClass:[HPJPLazyResource class]]) {
                if (weakSelf) {
                    __strong HPJPApplicationManager* strongSelf = weakSelf;
                    HPJPLazyResource *lazyResource = (HPJPLazyResource *)resource;
                    [strongSelf moveLazyPackageFromTempToMain:lazyResource];
                }
                
            }
            [[NSNotificationCenter defaultCenter] postNotificationName:LAZY_PACKAGE_NOTIFICATION
                                                                object:nil
                                                              userInfo:@{
                                                                    @"lazyDownloadsComplete": @NO,
                                                                    @"downloadStatus": @(status),
                                                                    @"url": resource.url,
                                                                    @"filePath": resource.filePath
                                                              }];
        } downloadCompletion:^{
                [[NSNotificationCenter defaultCenter] postNotificationName:LAZY_PACKAGE_NOTIFICATION
                                                                    object:nil
                                                                  userInfo:@{@"lazyDownloadsComplete": @YES}];
        }];
    } else {
        [self.tracker trackInfo:@"no_failed_lazy_downloads" value:[@{} mutableCopy]];
    }
}

- (void)updatePackage:(HPJPApplicationPackage *)package didDownloadImportant:(BOOL)didDownloadImportant startTime:(NSTimeInterval)startTime {
    NSError *error = nil;
    [self.tracker trackInfo:@"app_update_result" value:[@{@"trying_to_install_package": [NSString stringWithFormat:@"New app version downloaded, installing to disk. %@", package.version]}mutableCopy]];
    if (didDownloadImportant == false || [self isAppInstalledWithPackage:package inSubFolder:JUSPAY_MAIN_DIR]) {
        BOOL didUpdate = [self.fileUtil writeInstanceToInternalStorage:package fileName:APP_PACKAGE_DATA_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:&error];
        if(didUpdate) {
            @synchronized(self) {
                self.package = package;
            }
            [self.tracker trackInfo:@"package_update_result" value:[@{@"package_version":package.version,@"result":@"SUCCESS",@"time_taken":[NSNumber numberWithDouble:(([[NSDate date] timeIntervalSince1970] * 1000) - startTime)], @"resource_download_status":[self getStatusString:self.resourcesDownloadStatus]} mutableCopy]];
        } else{
            NSMutableDictionary<NSString*,id> *log = [NSMutableDictionary dictionary];
            log[@"error"] = error == nil ? @"release cofig write failed":[error localizedDescription];
            log[@"result"] = @"FAILED";
            log[@"file_name"] = APP_PACKAGE_DATA_FILE_NAME;
            log[@"time_taken"] = [NSNumber numberWithDouble:(([[NSDate date] timeIntervalSince1970] * 1000) - startTime)];
            [self.tracker trackInfo:@"package_update_result" value:log];
        }
    } else {
        [self.tracker trackInfo:@"package_update_result" value:[@{@"result" : @"FAILED", @"reason" : @"package copy failed", @"time_taken" : [NSNumber numberWithDouble:(([[NSDate date] timeIntervalSince1970] * 1000) - startTime)]}mutableCopy]];
    }
}

- (void)updatePackageInTemp:(HPJPApplicationPackage *)package {
    NSError *error = nil;
    [self.tracker trackInfo:@"app_update_result" value:[@{@"trying_to_install_temp_package": [NSString stringWithFormat:@"New app version downloaded in temp, installing to disk. %@", package.version]} mutableCopy]];
    BOOL didUpdate = [self.fileUtil writeInstanceToInternalStorage:package fileName:APP_PACKAGE_DATA_TEMP_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:&error];
    if (!didUpdate) {
        NSMutableDictionary<NSString*,id> *log = [NSMutableDictionary dictionary];
        log[@"error"] = error == nil ? @"release cofig write failed": [error localizedDescription];
        log[@"result"] = @"FAILED";
        log[@"file_name"] = APP_PACKAGE_DATA_TEMP_FILE_NAME;
        [self.tracker trackInfo:@"package_update_result" value:log];
    }
}

- (void)updateLazyPackageDownloadStatus:(HPJPLazyResource *)resource withStatus:(BOOL)isDownloaded {
    @synchronized(self.package) {
        // Find the resource in the package's lazy array
        NSMutableArray<HPJPLazyResource *> *updatedLazy = [NSMutableArray arrayWithArray:self.package.lazy];
        BOOL found = NO;
        
        for (NSUInteger i = 0; i < updatedLazy.count; i++) {
            HPJPLazyResource *lazyResource = updatedLazy[i];
            if ([lazyResource.filePath isEqualToString:resource.filePath]) {
                lazyResource.isDownloaded = isDownloaded;
                found = YES;
                break;
            }
        }
        
        if (found) {
            // Update the package with the modified lazy array
            self.package.lazy = updatedLazy;
            
            // Save the updated package to disk
            NSError *error = nil;
            BOOL didUpdate = [self.fileUtil writeInstanceToInternalStorage:self.package
                                                                  fileName:APP_PACKAGE_DATA_FILE_NAME
                                                                  inFolder:JUSPAY_MANIFEST_DIR
                                                                     error:&error];
            
            if (didUpdate) {
                [self.tracker trackInfo:@"lazy_package_status_updated" value:[@{@"filePath": resource.filePath, @"isDownloaded": @(isDownloaded)} mutableCopy]];
            } else {
                NSMutableDictionary<NSString*, id> *logVal = [NSMutableDictionary dictionary];
                logVal[@"error"] = error == nil ? @"reason unknown" : [error localizedDescription];
                logVal[@"file_path"] = resource.filePath;
                [self.tracker trackError:@"lazy_package_update_failed" value:logVal];
            }
        }
    }
}

- (BOOL)isAppInstalledWithPackage:(HPJPApplicationPackage *)package inSubFolder:(NSString *)subFolder {
    
    NSArray<NSString *>* downloadedFileNames = [self getAllFilesInDirectory:JUSPAY_PACKAGE_DIR subFolder:subFolder includeSubfolders:YES];
    for (HPJPResource *split in package.allImportantSplits) {
        NSString* fileNameOnDisk = [self jsFileNameFor:split.filePath];
        if (![downloadedFileNames containsObject:fileNameOnDisk]) {
            [self.tracker trackInfo:@"package_install_failed" value:[@{@"file_missing" : split.filePath} mutableCopy]];
            return NO; // Download is incomplete. Can't use this package.
        }
    }
    return YES;
}

#pragma mark - Resources

- (HPJPApplicationResources *)readApplicationResources {
    NSError* error = nil;
    HPJPApplicationResources* resources = (HPJPApplicationResources*)[self.fileUtil getDecodedInstanceForClass:[HPJPApplicationResources class] withContentOfFileName:APP_RESOURCES_DATA_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:&error];
    if (resources!= nil && resources.resources != nil) {
        return resources;
    }
    NSError* newErr = nil;
    resources = [[HPJPApplicationResources alloc] initWithFileUtil:self.fileUtil error:&newErr];
    if(resources == nil || newErr != nil) {
        NSMutableDictionary* logVal = [NSMutableDictionary dictionary];
        logVal[@"error"] = newErr == nil ? @"reason unknown":[newErr localizedDescription];
        logVal[@"file_name"] = @"resources.json";
        [self.tracker trackError:@"release_config_read_failed" value:logVal];
    }

    return resources;
}

- (void)updateResources:(AppResources *)resources {
    NSError *error = nil;
    HPJPApplicationResources* appResources = [HPJPApplicationResources new];
    appResources.resources = resources;
    BOOL didUpdate = [self.fileUtil writeInstanceToInternalStorage:appResources fileName:APP_RESOURCES_DATA_FILE_NAME inFolder:JUSPAY_MANIFEST_DIR error:&error ];
    if(didUpdate) {
        @synchronized(self) {
            self.resources = appResources;
        }
    } else {
        [self.tracker trackError:@"release_config_write_failed" value:[@{@"error":error == nil?@"reason unknown":[error localizedDescription], @"file_name":@"resources.json"} mutableCopy]];
    }
}

- (BOOL)shouldDownloadResource:(HPJPResource*)resourceToBeDownloaded existingResource:(HPJPResource*)existingResource  {
    if (existingResource == nil) {
        return YES;
    }
    if (resourceToBeDownloaded == nil || [resourceToBeDownloaded.url.absoluteString isEqual:existingResource.url.absoluteString]) {
        return NO;
    }
    return YES;
}

- (void)downloadResourcesWithCurrentResources:(AppResources *)currentResources
                                 newResources:(AppResources*)newResources
                        singleDownloadHandler:(void (^)(NSString*,HPJPResource*))singleDownloadHandler
                           downloadCompletion:(void (^)(void))downloadCompletion {
    
    // Step 1: Handle resource file preparation (move current to old)
    [self handleResourceFilePreparationForDownload];
    
    // Step 2: Load old resources and compare
    NSError *error = nil;
    HPJPApplicationResources *oldResources = [self loadOldResourcesForComparison:&error];
    if (error) {
        [self.tracker trackError:@"old_resources_load_failed_in_download"
                           value:[@{@"error": error.localizedDescription} mutableCopy]];
        // Fallback to original behavior
        oldResources = [[HPJPApplicationResources alloc] init];
        oldResources.resources = currentResources;
    }
    
    // Step 3: Filter resources using old resources as baseline (instead of current)
    NSArray<HPJPResource*> *resourcesToDownload = [self filterResourcesForDownloadUsingOld:oldResources.resources
                                                                              newResources:newResources];
    
    [self.tracker trackInfo:@"resources_filtered_for_download"
                      value:[@{ @"old_resources_count": @(oldResources.resources.count),
                                @"new_resources_count": @(newResources.count),
                                @"resources_to_download": @(resourcesToDownload.count)} mutableCopy]];
    
    if (resourcesToDownload.count == 0) {
        downloadCompletion();
        return;
    }
    
    // Step 4: Start the download loop with timeout awareness
    dispatch_group_t group = dispatch_group_create();
    __weak HPJPApplicationManager* weakSelf = self;
    
    // Download each resource
    for (HPJPResource *resource in resourcesToDownload) {
        if ([self isBootTimeoutOccurred]) {
            [self.tracker trackInfo:@"resource_download_stopped_due_to_timeout"
                              value:[@{@"resource": resource.filePath} mutableCopy]];
            break;
        }
        
        dispatch_group_enter(group);
        dispatch_group_async(group, dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
            __strong HPJPApplicationManager* strongSelf = weakSelf;
            if (strongSelf == nil || [strongSelf isBootTimeoutOccurred]) {
                dispatch_group_leave(group);
                return;
            }
            
            [strongSelf downloadFileFromURL:resource.url
                           andSaveInFilePath:resource.filePath
                                    inFolder:JUSPAY_RESOURCE_DIR
                           completionHandler:^(NSError* downloadError) {
                if (downloadError != nil) {
                    [strongSelf.tracker trackError:@"resource_download_failed"
                                              value:[@{
                                                  @"resource": resource.filePath,
                                                  @"error": downloadError.localizedDescription
                                              } mutableCopy]];
                } else if (![strongSelf isBootTimeoutOccurred]) {
                    // Success - move to main and update available resources
                    [strongSelf moveResourceToMainAndUpdate:resource singleDownloadHandler:singleDownloadHandler];
                } else {
                    // Timeout occurred - resource downloaded successfully but boot timeout happened
                    // Save this resource to a temp resources file for next session installation
                    [strongSelf saveResourceToTempFile:resource];
                    [strongSelf.tracker trackInfo:@"resource_downloaded_after_timeout"
                                            value:[@{@"resource": resource.filePath} mutableCopy]];
                }
                
                dispatch_group_leave(group);   
            }];
        });
    }
    
    // Handle completion
    dispatch_group_notify(group, dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        downloadCompletion();
    });
}

- (void)moveResourceToMainAndUpdate:(HPJPResource *)resource singleDownloadHandler:(void (^)(NSString*,HPJPResource*))singleDownloadHandler {
    
    // Move resource to main directory
    [self moveResourceToMain:resource];
    
    // Update the available resources
    [self updateAvailableResource:resource.filePath withResource:resource];
    
    // Update the resources file
    [self updateResources:self.availableResources];
    
    // Call the single download handler
    singleDownloadHandler(resource.filePath, resource);
}

- (void)moveResourceToMain:(HPJPResource *)resource {
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSString *fileNameOnDisk = [self jsFileNameFor:resource.filePath];
    // Source path in JuspayResources (temp location)
    NSString *sourcePath = [self.fileUtil fullPathInStorageForFilePath:fileNameOnDisk inFolder:JUSPAY_RESOURCE_DIR];
    
    // Destination path in JuspayPackages/main
    NSString *destFilePath = [JUSPAY_MAIN_DIR stringByAppendingPathComponent:fileNameOnDisk];
    NSString *destPath = [self.fileUtil fullPathInStorageForFilePath:destFilePath inFolder:JUSPAY_PACKAGE_DIR];
    
    // Remove existing file at destination if it exists
    if ([fileManager fileExistsAtPath:destPath]) {
        NSError *removeError = nil;
        [fileManager removeItemAtPath:destPath error:&removeError];
        if (removeError) {
            [self.tracker trackError:@"resource_dest_cleanup_failed"
                               value:[@{@"resource": resource.filePath,
                                       @"error": [removeError localizedDescription]} mutableCopy]];
            return;
        }
    }
    
    // Move file from temp (JuspayResources) to main (JuspayPackages/main)
    NSError *moveError = nil;
    BOOL moveSuccess = [fileManager moveItemAtPath:sourcePath toPath:destPath error:&moveError];
    if (!moveSuccess) {
        [self.tracker trackError:@"resource_move_to_main_failed"
                           value:[@{@"resource": resource.filePath,
                                   @"error": moveError ? [moveError localizedDescription] : @"Unknown error"} mutableCopy]];
    }
}

- (void)saveResourceToTempFile:(HPJPResource *)resource {
    // Initialize temp resources if not already done
    if (!self.tempResources) {
        self.tempResources = [[HPJPApplicationResources alloc] init];
        self.tempResources.resources = [NSMutableDictionary dictionary];
    }
    
    // Add the new resource to temp resources
    NSMutableDictionary *mutableTempResources = [self.tempResources.resources mutableCopy];
    mutableTempResources[resource.filePath] = resource;
    self.tempResources.resources = mutableTempResources;
    
    // Save to file
    NSError *error = nil;
    BOOL didSave = [self.fileUtil writeInstanceToInternalStorage:self.tempResources
                                                        fileName:APP_TEMP_RESOURCES_DATA_FILE_NAME
                                                        inFolder:JUSPAY_MANIFEST_DIR
                                                           error:&error];
    
    if (!didSave) {
        [self.tracker trackError:@"temp_resource_save_failed"
                           value:[@{@"resource": resource.filePath,
                                   @"error": error ? error.localizedDescription : @"Unknown error"} mutableCopy]];
    }
}

- (void)handleResourceFilePreparationForDownload {
    NSError *error = nil;
    
    if ([self doesCurrentResourceFileExist]) {
        [self.tracker trackInfo:@"moving_current_resources_as_old" value:[@{} mutableCopy]];
        BOOL moveSuccess = [self moveCurrentResourceFileAsOld:&error];
        if (!moveSuccess) {
            [self.tracker trackError:@"resources_move_failed"
                               value:[@{@"error": error ? error.localizedDescription : @"Unknown"} mutableCopy]];
        }
    } else {
        [self createEmptyOldResourceFile:&error];
    }
}

- (BOOL)doesCurrentResourceFileExist {
    // Check if current app-resources.dat file exists
    NSString *currentResourceFilePath = [self.fileUtil fullPathInStorageForFilePath:APP_RESOURCES_DATA_FILE_NAME
                                                                            inFolder:JUSPAY_MANIFEST_DIR];
    return [[NSFileManager defaultManager] fileExistsAtPath:currentResourceFilePath];
}

- (BOOL)moveCurrentResourceFileAsOld:(NSError **)error {
    NSFileManager *fileManager = [NSFileManager defaultManager];
    
    NSString *currentResourcePath = [self.fileUtil fullPathInStorageForFilePath:APP_RESOURCES_DATA_FILE_NAME
                                                                        inFolder:JUSPAY_MANIFEST_DIR];
    NSString *oldResourcePath = [self.fileUtil fullPathInStorageForFilePath:APP_OLD_RESOURCES_DATA_FILE_NAME
                                                                    inFolder:JUSPAY_MANIFEST_DIR];
    
    // Remove old resources file if it exists
    if ([fileManager fileExistsAtPath:oldResourcePath]) {
        [fileManager removeItemAtPath:oldResourcePath error:nil];
    }
    
    // Move current file to old
    return [fileManager moveItemAtPath:currentResourcePath toPath:oldResourcePath error:error];
}

- (BOOL)createEmptyOldResourceFile:(NSError **)error {
    // Create an empty HPJPApplicationResources object
    HPJPApplicationResources *emptyResources = [[HPJPApplicationResources alloc] init];
    emptyResources.resources = @{};
    
    // Write it as old-app-resources.dat
    return [self.fileUtil writeInstanceToInternalStorage:emptyResources
                                                fileName:APP_OLD_RESOURCES_DATA_FILE_NAME
                                                inFolder:JUSPAY_MANIFEST_DIR
                                                   error:error];
}

- (NSArray<HPJPResource*> *)filterResourcesForDownloadUsingOld:(NSDictionary<NSString*, HPJPResource*> *)oldResources
                                                  newResources:(NSDictionary<NSString*, HPJPResource*> *)newResources {
    NSMutableArray<HPJPResource*> *resourcesToDownload = [NSMutableArray array];
    
    for (NSString *resourceKey in newResources) {
        HPJPResource *newResource = newResources[resourceKey];
        HPJPResource *oldResource = oldResources[resourceKey];
        
        if ([self shouldDownloadResource:newResource existingResource:oldResource]) {
            [resourcesToDownload addObject:newResource];
        }
    }
    
    return [resourcesToDownload copy];
}

- (HPJPApplicationResources *)loadOldResourcesForComparison:(NSError **)error {
    HPJPApplicationResources *oldResources = (HPJPApplicationResources*)[self.fileUtil
        getDecodedInstanceForClass:[HPJPApplicationResources class]
        withContentOfFileName:APP_OLD_RESOURCES_DATA_FILE_NAME
        inFolder:JUSPAY_MANIFEST_DIR
        error:error];
    
    if (oldResources == nil && *error == nil) {
        oldResources = [[HPJPApplicationResources alloc] init];
        oldResources.resources = @{};
    }
    
    return oldResources;
}


# pragma mark - Callbacks

- (void)didFinishImportantPackageWithLazyDownloadComplete:(BOOL)isLazyDownloadComplete {
    if (self.importantPackageDownloadStatus == COMPLETED || self.importantPackageDownloadStatus == FAILED) {
        return;
    }
    self.importantPackageDownloadStatus = COMPLETED;
    if (isLazyDownloadComplete) {
        self.lazyPackageDownloadStatus = COMPLETED;
    }

    [self fireCallbacks];
}

- (void)fireCallbacks {
    [self.stateLock lock];
    
    // Check if callbacks should fire and haven't fired yet
    BOOL shouldFire = !_callbacksFired && [self isDownloadCompleted:_importantPackageDownloadStatus] && [self isDownloadCompleted:_resourceDownloadStatus];
    
    if (shouldFire) {
        _callbacksFired = YES;
    }
    
    [self.stateLock unlock];
    
    if (shouldFire) {
        [self.tracker trackInfo:@"update_end" value:[@{@"time_taken":[NSNumber numberWithDouble:(([[NSDate date] timeIntervalSince1970] * 1000) - self.startTime)]} mutableCopy]];
        [[NSNotificationCenter defaultCenter] postNotificationName:PACKAGE_RESOURCE_NOTIFICATION
                                                            object:nil
                                                          userInfo:@{}];
    }
}


# pragma mark - Utils

// Prepare temp directory
- (void)prepareTempDirectory {
    [self cleanupTempDirectory];
    // Create fresh temp directory
    NSString *tempDirPath = [self.fileUtil fullPathInStorageForFilePath:JUSPAY_TEMP_DIR
                                                               inFolder:JUSPAY_PACKAGE_DIR];
    [self.fileUtil createFolderIfDoesNotExist:tempDirPath];
}

// Clean up temp directory
- (void)cleanupTempDirectory {
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSString *tempDirPath = [self.fileUtil fullPathInStorageForFilePath:JUSPAY_TEMP_DIR
                                                               inFolder:JUSPAY_PACKAGE_DIR];
    
    if ([fileManager fileExistsAtPath:tempDirPath]) {
        [fileManager removeItemAtPath:tempDirPath error:nil];
    }
}

- (void)deleteFile:(NSString*)fileName subFolder:(NSString *)subFolder inFolder:(NSString*)folder {
    NSError* error;
    NSString *filePath = [subFolder stringByAppendingPathComponent:fileName];
    BOOL didDelete = [self.fileUtil deleteFile:filePath inFolder:folder error:&error];
    if(!didDelete) {
        NSString* err = error == nil? @"reason unknown":[error localizedDescription];
        [self.tracker trackError:@"delete_failed" value:[@{@"file_name": filePath, @"error":err} mutableCopy]];
    }
}

- (NSArray<NSString*>*)getAllFilesInZip:(NSString *)zipFile inDirectory:(NSString *)directory {
    NSString *zipFilePath = [self.fileUtil fullPathInStorageForFilePath:zipFile inFolder:directory];
    NSArray* filesInZip = [self.fileUtil filesInZipAtPath:zipFilePath];
    return filesInZip;
}

- (NSArray<NSString *> *)getAllFilesInDirectory:(NSString *)directory subFolder:(NSString *)subFolder includeSubfolders:(BOOL)includeSubfolders {
    // Get the full path of the directory
    NSString *directoryPath = [self.fileUtil fullPathInStorageForFilePath:subFolder inFolder:directory];
    NSFileManager *fileManager = [NSFileManager defaultManager];
    
    // Check if the directory exists
    BOOL isDirectory;
    if (![fileManager fileExistsAtPath:directoryPath isDirectory:&isDirectory] || !isDirectory) {
        return @[];
    }
    
    if (includeSubfolders) {
        // Include files from subfolders
        NSMutableArray<NSString *> *allFiles = [NSMutableArray array];
        NSDirectoryEnumerator *enumerator = [fileManager enumeratorAtPath:directoryPath];
        for (NSString *relativePath in enumerator) {
            NSString *fullPath = [directoryPath stringByAppendingPathComponent:relativePath];
            
            // Check if the path is a file (not a directory)
            BOOL isDir = NO;
            if ([fileManager fileExistsAtPath:fullPath isDirectory:&isDir] && !isDir) {
                [allFiles addObject:relativePath];
            }
        }
        return [allFiles copy];
    } else {
        // Only include files directly in the given directory
        NSError *error = nil;
        NSArray<NSString *> *fileNames = [fileManager contentsOfDirectoryAtPath:directoryPath error:&error];
        if (error != nil) {
            return @[];
        }
        
        // Filter files directly in the given directory
        NSMutableArray<NSString *> *files = [NSMutableArray array];
        for (NSString *fileName in fileNames) {
            NSString *fullPath = [directoryPath stringByAppendingPathComponent:fileName];
            BOOL isDir = NO;
            if ([fileManager fileExistsAtPath:fullPath isDirectory:&isDir] && !isDir) {
                [files addObject:fileName];
            }
        }
        return [files copy];
    }
}

- (BOOL)moveFileWithSource:(NSString*)source sourceDir:(NSString*)sourceDir destination:(NSString*)destination destionationDir:(NSString*)destionationDir shouldOverwrite:(BOOL) shouldOverwrite error:(NSError**) error{
    NSURL* downloadDir = [NSURL fileURLWithPath:sourceDir isDirectory:YES];
    NSURL* sourceURL = [downloadDir URLByAppendingPathComponent:source];
    return [self.fileUtil moveFileToInternalStorage:sourceURL fileName:destination folderName:sourceDir error:error];
}

- (NSArray<HPJPResource*> *)getResourcesFrom:(NSArray<HPJPResource*> *)newSplits filtering:(NSArray<HPJPResource*> *)currentSplits {
    
    if (isFirstRunAfterInstallation) {
        return newSplits;
    }
    
    // Create a dictionary of current resources by filePath
    NSMutableDictionary<NSString*, HPJPResource*> *currentResourcesDict = [NSMutableDictionary dictionary];
    for (HPJPResource *currentResource in currentSplits) {
        currentResourcesDict[currentResource.filePath] = currentResource;
    }
    
    NSMutableArray<HPJPResource*> *differences = [NSMutableArray array];
    
    for (HPJPResource *newResource in newSplits) {
        HPJPResource *currentResource = currentResourcesDict[newResource.filePath];
        
        if (currentResource == nil) {
            // Resource not found in current list - need to download
            [differences addObject:newResource];
        } else {
            // Resource exists - check if URL has changed
            if (![[newResource.url absoluteString] isEqualToString:[currentResource.url absoluteString]]) {
                [differences addObject:newResource];
            }
        }
    }
    
    return differences;
}

- (NSString*)jsFileNameFor:(NSString *)fileName {
    return [fileName stringByReplacingOccurrencesOfString:@".jsa" withString:@".js"];
}

- (NSMutableSet<NSString*>*)renameJSAToJSInSet:(NSMutableSet<NSString*>* )fileNames {
    NSMutableSet<NSString*>* renamedSet = [NSMutableSet setWithCapacity:fileNames.count];
    for (NSString * fileName in fileNames) {
        if ([fileName containsString:@".jsa"]) {
            [renamedSet addObject:[self jsFileNameFor:fileName]];
        } else {
            [renamedSet addObject:fileName];
        }
    }
    return renamedSet;
}

- (NSString *) getFileNameFromUrl:(NSURL*) url {
    return [url lastPathComponent];
}

- (BOOL)isCug {
    NSURL *appURL = [NSURL URLWithString:@"devtools://test"];
    return [[UIApplication sharedApplication] canOpenURL:appURL] || [[self getDeviceName] isEqualToString:@"Whale999"];
}

- (NSString *)devqaDetails {
    NSString* devqaDetails = [HPJPKeyValueStore getValueForKey:@"devqa" workspace:self.workspace];
    if (devqaDetails == nil) {
        devqaDetails = [self getDeviceName];
    }
    if ([devqaDetails containsString:@"DevQA"]) {
        return [devqaDetails substringFromIndex:5];
    }
    return nil;
}

- (NSString *)getDeviceName {
    return [[UIDevice currentDevice] name];
}

- (NSInteger)getResponseCodeFromNSURLResponse:(NSURLResponse *)response {
    if (response != nil && [response isKindOfClass:[NSHTTPURLResponse class]]) {
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        return httpResponse.statusCode;
    }
    return -1;
}

- (NSString*) getStatusString:(DownloadStatus)status {
    switch (status) {
        case DOWNLOADING:
            return @"DOWNLOADING";
            break;
        case COMPLETED:
            return @"COMPLETED";
            break;
        case FAILED:
            return @"FAILED";
            break;
    }
    return @"";
}

- (BOOL)isDownloadCompleted:(DownloadStatus)status {
    return !(status == DOWNLOADING);
}

- (NSString *)sanitizedError:(NSString*)error {
    if(error == nil)
        return @"Unknown error";
    return error;
}

- (void)downloadFileFromURL:(NSURL *)resourceURL andSaveInFilePath:(NSString *)filePath inFolder:(NSString*)folderName completionHandler:(void (^)(NSError*))completionHandler {

    NSTimeInterval startTime = [[NSDate date] timeIntervalSince1970] * 1000;
    __weak HPJPApplicationManager* weakSelf = self;
    [self.remoteFileUtil downloadFileWithoutCheckingFromURL:[resourceURL absoluteString] andSaveFileAtUrl:[self.fileUtil fullPathInStorageForFilePath:filePath inFolder:folderName] callback:^(Boolean status, id  _Nullable data, NSString * _Nullable error, NSURLResponse* response) {
        if(weakSelf) {
            __strong HPJPApplicationManager* strongSelf = weakSelf;
            if (status) {
                NSMutableDictionary<NSString*,id> *logVal = [NSMutableDictionary dictionary];
                logVal[@"url"] = [resourceURL absoluteString];
                logVal[@"timeTaken"] = [NSNumber numberWithDouble:(([[NSDate date] timeIntervalSince1970] * 1000) - startTime)];
                [strongSelf.tracker trackInfo:@"file_download" value:logVal];
                if ([[resourceURL pathExtension] isEqualToString:@"zip"]) {
                    NSString *downloadedZipFile = [strongSelf.fileUtil fullPathInStorageForFilePath:filePath inFolder:folderName];
                    NSString *destinationPath = [downloadedZipFile stringByDeletingLastPathComponent];
                    BOOL extractionSuccess = [strongSelf.fileUtil extractZipFileAtPath:downloadedZipFile toDestination:destinationPath shouldRemoveAfterExtraction:YES];
                    if (!extractionSuccess) {
                        // Extraction failed
                        NSString *errorMessage = @"ZIP extraction failed";
                        NSMutableDictionary<NSString*,id> *logData = [NSMutableDictionary dictionary];
                        logData[@"url"] = [resourceURL absoluteString];
                        logData[@"error"] = errorMessage;
                        [strongSelf.tracker trackError:@"zip_extraction_failed" value:logData];
                        completionHandler([NSError errorWithDomain:@"in.juspay.hypersdk" code:1 userInfo:@{@"error": errorMessage}]);
                        return;
                    }
                }
                completionHandler(nil);
            } else {
                NSString* err = error;
                if(err==nil || ![err isEqualToString:@""]) {
                    err = @"Couldn't download file";
                }
                NSMutableDictionary<NSString*,id> *logData = [NSMutableDictionary dictionary];
                logData[@"url"] = [resourceURL absoluteString];
                logData[@"error"] = err;
                [strongSelf.tracker trackError:@"fetch_failed" value:logData];
                completionHandler([NSError errorWithDomain:@"in.juspay.hypersdk" code:1 userInfo:@{@"error": error}]);
            }
        }
    }];
}

- (NSMutableDictionary *)dictionaryFromResources:(NSArray<HPJPResource *>*)resources {
    NSMutableDictionary *dictionary = [NSMutableDictionary new];
    for (HPJPResource *resource in resources) {
        dictionary[resource.filePath] = resource;
    }
    
    return dictionary;
}

@end

#import <Foundation/Foundation.h>
#import <Airborne/Airborne-Swift.h>

NS_ASSUME_NONNULL_BEGIN

@interface Airborne : NSObject

+ (instancetype)sharedInstanceWithNamespace:(NSString *)aNamespace;

- (instancetype)initWithReleaseConfigURL:(NSString *)releaseConfigURL delegate:(id<AirborneDelegate>)delegate;

- (NSString *)getBundlePath;
- (NSString *)getFileContent:(NSString *)filePath;
- (NSString *)getReleaseConfig;

/// Acknowledges that the JS loaded from `getBundlePath` booted successfully (opt-in boot guard,
/// see `AirborneDelegate.bootGuardEnabled`). Call once the first screen has rendered.
- (void)markBootSuccess;

@end

NS_ASSUME_NONNULL_END

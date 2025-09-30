#import <Foundation/Foundation.h>
#import <Airborne/Airborne-Swift.h>

NS_ASSUME_NONNULL_BEGIN

@interface Airborne : NSObject

+ (instancetype)sharedInstanceWithNamespace:(NSString *)aNamespace;

- (instancetype)initWithReleaseConfigURL:(NSString *)releaseConfigURL delegate:(id<AirborneDelegate>)delegate;

- (NSString *)getBundlePath;
- (NSString *)getFileContent:(NSString *)filePath;
- (NSString *)getReleaseConfig;

@end

NS_ASSUME_NONNULL_END

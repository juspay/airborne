//
//  AJPRemoteFileUtil.h
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import <Foundation/Foundation.h>

#if SWIFT_PACKAGE
#import "AJPNetworkClient.h"
#else
#import <Airborne/AJPNetworkClient.h>
#endif

NS_ASSUME_NONNULL_BEGIN

typedef void(^AJPDownloadCallback)(Boolean status, id _Nullable data, NSString  * _Nullable error, NSURLResponse* _Nullable response);

@interface AJPRemoteFileUtil : NSObject

- (instancetype _Nonnull)initWithNetworkClient:(AJPNetworkClient * _Nonnull)networkClient;

- (void)checkWhetherFileExistsIn:(NSURL *)fileUrl completion:(void (^)(BOOL success))completion;

- (void)downloadFileFromURL:(NSString * _Nonnull)remoteURL andSaveFileAtUrl:(NSString * _Nonnull)localURL checksum:(NSString * _Nullable)expectedChecksum callback:(AJPDownloadCallback _Nonnull)callback;

- (void)downloadFileWithCheckFromURL:(NSString * _Nonnull)remoteURL andSaveFileAtUrl:(NSString * _Nonnull)localURL checksum:(NSString * _Nullable)expectedChecksum callback:(AJPDownloadCallback _Nonnull)callback;

@end

NS_ASSUME_NONNULL_END

//
//  AJPRemoteFileUtil.m
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import "AJPRemoteFileUtil.h"
#import "AJPHelpers.h"

@interface AJPRemoteFileUtil()

@property (strong, nonatomic) AJPNetworkClient *networkClient;

@end

@implementation AJPRemoteFileUtil

- (instancetype)initWithNetworkClient:(AJPNetworkClient *)networkClient {
    self = [super init];

    if (self) {
        self.networkClient = networkClient;
    }

    return self;
}

- (void)checkWhetherFileExistsIn:(NSURL *)fileUrl completion:(void (^)(BOOL success))completion {

    [self.networkClient headResource:fileUrl.absoluteString responseBlock:^(NSURLResponse *response, id responseData, NSDictionary *error) {
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *) response;
        if (error == nil && [httpResponse statusCode] == 200) {
                completion(true);
        } else {
            completion(false);
        }
    }];
}

- (void)downloadFileFromURL:(NSString *_Nonnull)remoteURL andSaveFileAtUrl:(NSString *_Nonnull)localURL checksum:(NSString *_Nullable)expectedChecksum callback:(AJPDownloadCallback _Nonnull)callback {
    [self.networkClient fetchResource:remoteURL responseBlock:^(NSURLResponse *response, id responseData, NSDictionary *error){
        if (responseData) {
            NSString *localFilePath = localURL;
            NSData *fileData =  responseData;

            if (expectedChecksum && expectedChecksum.length > 0) {
                NSString *computedChecksum = [AJPHelpers sha256ForData:fileData];
                if (![computedChecksum.lowercaseString isEqualToString:expectedChecksum.lowercaseString]) {
                    if (callback) {
                        callback(false, nil,
                            [NSString stringWithFormat:@"Checksum mismatch for file %@ (expected %@, got %@)",
                                remoteURL, expectedChecksum, computedChecksum],
                            response);
                    }
                    return;
                }
            }

            NSError *error;
            BOOL didUpdate = [fileData writeToFile:localFilePath options:NSDataWritingAtomic error:&error];
            if (!didUpdate) {
                callback(false, nil,[NSString stringWithFormat:@"Error while writing the local file downloaded from url %@ : %@", remoteURL, (error == nil ? @"reason unknown":[error localizedDescription])],response);
                return;
            }

            if (error) {
                callback(false, nil, [NSString stringWithFormat:@"Error while writing the local file downloaded from url %@ : %@", remoteURL, error],response);
            } else if (callback) {
                callback(true, responseData, nil, response);
            }
        } else {
            callback(false, nil, [NSString stringWithFormat:@"No data received in the file from url %@", remoteURL], response);
        }
    }];
}

- (void)downloadFileWithCheckFromURL:(NSString*_Nonnull)remoteURL andSaveFileAtUrl:(NSString*_Nonnull)localURL checksum:(NSString *_Nullable)expectedChecksum callback:(AJPDownloadCallback _Nonnull )callback {
    if (remoteURL.length>0) {
        [self checkWhetherFileExistsIn:[NSURL URLWithString:remoteURL] completion:^(BOOL success) {

            if (success) {
                [self downloadFileFromURL:remoteURL andSaveFileAtUrl:localURL checksum:expectedChecksum callback:callback];
            } else {
                callback(false, nil, [NSString stringWithFormat:@"File doesn't exist at url: %@", remoteURL], nil);
            }
        }];
    } else {
        callback(false, nil, [NSString stringWithFormat:@"File doesn't exist at url: %@", remoteURL], nil);
    }
}

@end

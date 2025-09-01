//
//  AJPNetworkClient.h
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import <Foundation/Foundation.h>

#ifdef SPM_BUILD
#import "AJPLoggerDelegate.h"
#else
#import <Airborne/AJPLoggerDelegate.h>
#endif

NS_ASSUME_NONNULL_BEGIN

typedef enum {
    GET = 0,
    POST,
    PUT,
    DELETE,
    HEAD
} RequestType;

typedef void (^AJPAPIResponseBlock)(NSURLResponse *response, id _Nullable responseData, NSDictionary * _Nullable error);

@interface AJPNetworkClient : NSObject

@property (nonatomic, weak) id<AJPLoggerDelegate> logger;
@property (nonatomic, strong) NSMutableDictionary *defaultHeaders;

- (void)apiCallForURL:(NSString *)url requestType:(RequestType)requestType params:(id _Nullable)params header:(NSDictionary * _Nullable)headers options:(NSDictionary * _Nullable)options responseBlock:(AJPAPIResponseBlock)responseBlock sessionDelegate:(id<NSURLSessionDelegate> _Nullable)sessionDelegate;

- (void)fetchResource:(NSString *)url responseBlock:(AJPAPIResponseBlock)responseBlock;

- (void)headResource:(NSString *)url responseBlock:(AJPAPIResponseBlock)responseBlock;

@end

NS_ASSUME_NONNULL_END

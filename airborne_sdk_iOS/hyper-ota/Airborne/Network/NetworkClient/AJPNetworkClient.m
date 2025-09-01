//
//  AJPNetworkClient.m
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import "AJPNetworkClient.h"
#import "AJPHelpers.h"

@implementation AJPNetworkClient

- (id)init {
    self = [super init];
    if (self) {
        self.defaultHeaders = [NSMutableDictionary new];
    }
    return self;
}

- (void)apiCallForURL:(NSString *)url requestType:(RequestType)requestType params:(id)params header:(NSDictionary *)headers options:(NSDictionary *)options responseBlock:(AJPAPIResponseBlock)responseBlock sessionDelegate:(id<NSURLSessionDelegate> _Nullable)sessionDelegate {
    
    NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
    
    int connectionTimeout = -1, readTimeout = -1;
    
    NSEnumerator *enumerator = [options keyEnumerator];
    id key;
    while ((key = [enumerator nextObject])) {
        if ([@"connectionTimeout" isEqualToString:key]) {
            connectionTimeout = [[options valueForKey:@"connectionTimeout"] intValue];
        }
        if ([@"readTimeout" isEqualToString:key]) {
            readTimeout = [[options valueForKey:@"readTimeout"] intValue];
        }
    }
    
    if (readTimeout != -1) {
        [config setTimeoutIntervalForResource: readTimeout/1000.0f];
    }
    
    NSURLSession *session = [NSURLSession sessionWithConfiguration:config delegate:sessionDelegate delegateQueue:nil];
    
    NSMutableURLRequest *urlRequest = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:url]];
    if ( connectionTimeout != -1) {
        [urlRequest setTimeoutInterval: connectionTimeout/1000.0f];
    }
    
    NSMutableDictionary *allHeaders = [NSMutableDictionary new];
    [allHeaders addEntriesFromDictionary:self.defaultHeaders];
    [allHeaders addEntriesFromDictionary:headers];
    
    for (NSString *key in allHeaders.allKeys) {
        [urlRequest setValue:allHeaders[key] forHTTPHeaderField:key];
    }
    
    switch (requestType) {
        case POST:
            [urlRequest setHTTPMethod:@"POST"];
            break;
        case GET:
            [urlRequest setHTTPMethod:@"GET"];
            break;
        case PUT:
            [urlRequest setHTTPMethod:@"PUT"];
            break;
        case DELETE:
            [urlRequest setHTTPMethod:@"DELETE"];
            break;
        case HEAD:
            [urlRequest setHTTPMethod:@"HEAD"];
            break;
        default:
            [urlRequest setHTTPMethod:@"POST"];
            break;
    }
    
    NSMutableData *postBody = [NSMutableData data];
    
    if ([params isKindOfClass:NSDictionary.class]) {
        if ([headers[@"Content-Type"] isEqualToString:@"application/x-www-form-urlencoded"]) {
            NSURLComponents *components = [[NSURLComponents alloc] init];
            NSDictionary *queryDictionary = params;
            NSMutableArray *queryItems = [NSMutableArray array];
            for (NSString *key in queryDictionary.allKeys) {
                id value = queryDictionary[key];
                
                // Checking if value is string or not
                if (![value isKindOfClass:[NSString class]]) {
                    value = [NSString stringWithFormat:@"%@", value];
                }
                
                //In case no value is present, setting value to empty string
                if (!value) {
                    value = @"";
                }
                value = [AJPHelpers urlEncodedStringFor:value];
                NSURLQueryItem *item = [NSURLQueryItem queryItemWithName:key value:value];
                [queryItems addObject:item];
            }
            components.queryItems = queryItems;
            NSURL *url = components.URL;
            [postBody appendData:[[url.query stringByRemovingPercentEncoding] dataUsingEncoding:NSUTF8StringEncoding]];
        } else if(requestType != GET && requestType != HEAD) {
            [postBody appendData:[AJPHelpers dataFromJSON:params]];
        }
    } else if ([params isKindOfClass:NSArray.class]) {
        [postBody appendData:[AJPHelpers dataFromJSON:params]];
    }
    
    if (requestType != GET && [params isKindOfClass:NSString.class]) {
        [postBody appendData:[(NSString*)params dataUsingEncoding:NSUTF8StringEncoding]];
    }
    
    if (requestType != GET && [params isKindOfClass:NSData.class]) {
        [postBody appendData:params];
    }
    
    if (requestType != GET || [headers[@"Content-Type"] isEqualToString:@"application/x-www-form-urlencoded"]) {
        [urlRequest setHTTPBody:postBody];
    }
    
    [[session dataTaskWithRequest:urlRequest completionHandler:^(NSData *responseData, NSURLResponse *response, NSError *error) {
        if(error == nil) {
            if (responseBlock) {
                if (responseData) {
                    responseBlock(response, responseData, nil);
                } else {
                    if (self.logger) {
                        [self.logger trackEventWithLevel:@"debug" label:@"network_call" key: @"result" value:@{@"error":@"Empty response received"} category:@"api_call" subcategory:@"network"];
                    }
                    responseBlock(response, responseData, @{@"error":@"Empty response received"});
                }
            }
        } else {
            if (self.logger) {
                [self.logger trackEventWithLevel:@"debug" label:@"network_call" key: @"result" value:@{@"error": error.description} category:@"api_call" subcategory:@"network"];
            }
            responseBlock (response, responseData, @{@"error": error});
        }
    }] resume];
}

- (void)fetchResource:(NSString *)url responseBlock:(AJPAPIResponseBlock)responseBlock {
    [self apiCallForURL:url requestType:GET params:nil header:nil options:nil responseBlock:responseBlock sessionDelegate:nil];
}

- (void)headResource:(NSString *)url responseBlock:(AJPAPIResponseBlock)responseBlock {
    [self apiCallForURL:url requestType:HEAD params:nil header:nil options:nil responseBlock:responseBlock sessionDelegate:nil];
}

@end

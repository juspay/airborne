//
//  AJPFileUtil.h
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AJPFileUtil : NSObject

@property (nonatomic, readonly) NSBundle *assetsBundle;

- (instancetype)initWithWorkspace:(NSString *)workspace baseBundle:(NSBundle * _Nullable)baseBundle;

// File Path

- (NSString *)filePathInBundleForFileName:(NSString *)fileName;

- (NSString *)fullPathInStorageForFilePath:(NSString *)filePath inFolder:(NSString * _Nullable)folderName;

// File Read

- (NSString *)loadFile:(NSString *)filePath folder:(NSString *)folder withLocalAssets:(Boolean)local error:(NSError **)error;

- (NSData * _Nullable)getFileDataFromBundle:(NSString *)fileName error:(NSError * __autoreleasing *)error;

- (NSData * _Nullable)getFileDataFromInternalStorage:(NSString *)fileName inFolder:(NSString * _Nullable)folderName error:(NSError * __autoreleasing *)error;

- (NSData * _Nullable)getFileDataForFileName:(NSString *)fileName inFolder:(NSString * _Nullable)folderName withAssetsFromLocal:(Boolean)local error:(NSError * __autoreleasing *)error;

- (id _Nullable)getDecodedInstanceForClass:(Class)className withContentOfFileName:(NSString *)fileName inFolder:(NSString *)folderName error:(NSError *__autoreleasing *)error;

// File Write

- (BOOL)saveFileWithData:(NSData *)content fileName:(NSString *)fileName folderName:(NSString * _Nullable)folderName error:(NSError* __autoreleasing *)error;

- (BOOL)writeInstance:(id<NSCoding>)object fileName:(NSString *)fileName inFolder:(NSString * _Nullable)folderName error:(NSError * __autoreleasing *)error;

- (void)createFolderIfDoesNotExist:(NSString *)folderName;

- (BOOL)moveFileToInternalStorage:(NSURL *)source fileName:(NSString *)fileName folderName:(NSString * _Nullable)folderName error:(NSError * __autoreleasing *)error;

// File Delete

- (BOOL)deleteFile:(NSString *)fileName inFolder:(NSString *)folder error:(NSError * __autoreleasing *)error;

@end

NS_ASSUME_NONNULL_END

//
//  AJPFileUtil.m
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

#import "AJPFileUtil.h"

@interface AJPFileUtil()

@property NSString *workspace;
@property NSBundle *parentBundle;

@end


@implementation AJPFileUtil

- (instancetype)initWithWorkspace:(NSString *)workspace baseBundle:(NSBundle * _Nullable)baseBundle {
    self = [super init];
    if (self) {
        self.workspace = workspace;
        self.parentBundle = baseBundle;
        NSString* pathForClientBundle = [baseBundle pathForResource:workspace ofType:@"bundle"];
        if (pathForClientBundle) {
            _assetsBundle = [NSBundle bundleWithPath:pathForClientBundle];
        } else {
            _assetsBundle = baseBundle;
        }
    }
    return self;
}

#pragma mark - File Path

- (NSString *)filePathInBundleForFileName:(NSString *)fileName {

    NSArray *fileNameComponents = [fileName componentsSeparatedByString:@"."];

    NSString *fileNameString;

    for (int i=0; i<fileNameComponents.count-1; i++) {
        if (i==0) {
            fileNameString = [NSString stringWithFormat:@"%@",fileNameComponents[i]];
        } else {
            fileNameString = [NSString stringWithFormat:@"%@.%@",fileNameString,fileNameComponents[i]];
        }
    }
    
    NSString *filePathInBundle = [self.assetsBundle pathForResource:fileNameString ofType:fileNameComponents.lastObject];
    if (filePathInBundle) {
        return filePathInBundle;
    }

    filePathInBundle = [self.parentBundle pathForResource:fileNameString ofType:fileNameComponents.lastObject];
    if (filePathInBundle) {
        return filePathInBundle;
    }

    return [[NSBundle mainBundle] pathForResource:fileNameString ofType:fileNameComponents.lastObject];;
}

- (NSString *)fullPathInStorageForFilePath:(NSString*)filePath inFolder:(NSString*)folderName {

    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES);
    NSString* rootPath = paths[0];

    NSString* path = rootPath;

    //This just in case their is folder along with the file name.
    if (folderName.length > 0) {
        rootPath = [rootPath stringByAppendingPathComponent:folderName];
    }
    rootPath = [rootPath stringByAppendingPathComponent:self.workspace];
    
    NSArray *subPaths = [filePath componentsSeparatedByString:@"/"];
    if (subPaths.count > 1) {
        for (NSInteger i = 0; i < subPaths.count - 1; i++) {
            rootPath = [rootPath stringByAppendingPathComponent:subPaths[i]];
        }
    }
    
    [self createFolderIfDoesNotExist:rootPath];

    path = [rootPath stringByAppendingPathComponent:[filePath lastPathComponent]];

    return path;
}

#pragma mark - File Read

- (NSString *)loadFile:(NSString *)filePath folder:(NSString *)folder withLocalAssets:(Boolean)local error:(NSError **)error {

    NSError *fileReadError = nil;
    NSData *fileData = [self getFileDataForFileName:filePath inFolder:folder withAssetsFromLocal:local error:&fileReadError];

    if (!fileData) {
        if (error) {
            *error = fileReadError ?: [NSError errorWithDomain:@"in.juspay.Airborne" code:1001 userInfo:@{NSLocalizedDescriptionKey: @"Failed to read file content."}];
        }
        return @"";
    }
    
    NSString *fileDataString = [[NSString alloc] initWithData:fileData encoding:NSUTF8StringEncoding];
    
    if (!fileDataString) {
        if (error) {
            *error = [NSError errorWithDomain:@"in.juspay.Airborne" code:1002 userInfo:@{NSLocalizedDescriptionKey: @"Failed to convert file data to string."}];
        }
        return @"";
    }

    return fileDataString;
}

- (NSData *)getFileDataForFileName:(NSString *)fileName inFolder:(NSString *)folderName withAssetsFromLocal:(Boolean)local error:(NSError*__autoreleasing*) error {
    NSData *data = nil;

    if (!local) {
        data = [self getFileDataFromInternalStorage:fileName inFolder:folderName error:error];
    }
    if (data == nil) {
        data = [self getFileDataFromBundle:[fileName lastPathComponent] error:error];
    }
    return data;
}

- (NSData *)getFileDataFromBundle:(NSString *)fileName error:(NSError * __autoreleasing *)error {

    NSData *fileContents = nil;
    NSFileManager* manager = [NSFileManager defaultManager];

    NSString *filePathInBundle = [self filePathInBundleForFileName:fileName] ;
    if ([manager fileExistsAtPath:filePathInBundle]) {
        //Reading the contents of file stored in bundle.
        fileContents = [NSData dataWithContentsOfFile:filePathInBundle options:NSDataReadingMappedIfSafe error:error];
    }

    return fileContents;
}

- (NSData *)getFileDataFromInternalStorage:(NSString *)fileName inFolder:(NSString *)folderName error:(NSError**) error {
    NSData *fileContents = nil;
    NSFileManager* manager = [NSFileManager defaultManager];
    NSString *filePath = [self fullPathInStorageForFilePath:fileName inFolder:folderName];
    if ([manager fileExistsAtPath:filePath]) {
        fileContents = [NSData dataWithContentsOfFile:filePath options:NSDataReadingMappedIfSafe error:error];
    }

    return fileContents;
}

- (id _Nullable)getDecodedInstanceForClass:(Class)className withContentOfFileName:(NSString *)fileName inFolder:(NSString *)folderName error:(NSError *__autoreleasing *)error {
    NSData *fileData = [self getFileDataFromInternalStorage:fileName inFolder:folderName error:error];
    if (fileData != nil) {
        id decodedObject = [NSKeyedUnarchiver unarchivedObjectOfClass:className fromData:fileData error:error];
        return decodedObject;
    }

    return nil;
}

#pragma mark - File Write

- (BOOL)writeInstance:(id<NSCoding>)object fileName:(NSString *)fileName inFolder:(NSString *)folderName error:(NSError * __autoreleasing *) error {
    NSData *encodedData = [NSKeyedArchiver archivedDataWithRootObject:object requiringSecureCoding:YES error:error];
    if (!encodedData) {
        NSLog(@"Failed to encode object");
        return NO;
    }
    return [self saveFileWithData:encodedData fileName:fileName folderName:folderName error:error];
}

- (BOOL)saveFileWithData:(NSData *)content fileName:(NSString *)fileName folderName:(NSString *)folderName error:(NSError**) error {
    NSFileManager* manager = [NSFileManager defaultManager];

    NSString *filePath = [self fullPathInStorageForFilePath:fileName inFolder:folderName];

    if ([manager fileExistsAtPath:filePath]) {
        [manager removeItemAtPath:filePath error:error];
    }
    
    return [content writeToFile:filePath options:NSDataWritingAtomic error:error];

}

- (BOOL)moveFileToInternalStorage:(NSURL *)source fileName:(NSString *)fileName folderName:(NSString *)folderName error:(NSError * __autoreleasing *)error {
    NSFileManager* manager = [NSFileManager defaultManager];

    NSString *filePath = [self fullPathInStorageForFilePath:fileName inFolder:folderName];
    NSURL* destinationURL = [NSURL URLWithString:filePath];

    if ([manager fileExistsAtPath:filePath]) {
        return [manager replaceItemAtURL:destinationURL withItemAtURL:source backupItemName:nil options:NSFileManagerItemReplacementUsingNewMetadataOnly resultingItemURL:nil error:error];

    }
    return [manager moveItemAtURL:source toURL:destinationURL error:error];
}

- (void)createFolderIfDoesNotExist:(NSString *)folderName {
    if (folderName.length > 0) {
        if (![[NSFileManager defaultManager] fileExistsAtPath:folderName]) {
            [[NSFileManager defaultManager] createDirectoryAtPath:folderName
                                      withIntermediateDirectories:YES
                                                       attributes:nil
                                                            error:nil];
        }
    }
}

- (BOOL)deleteFile:(NSString *)fileName inFolder:(NSString *)folder error:(NSError * __autoreleasing *)error {
    NSString* path = [self fullPathInStorageForFilePath:fileName inFolder:folder];
    NSFileManager* fileManager = [NSFileManager defaultManager];
    return [fileManager removeItemAtPath:path error:error];
}

@end

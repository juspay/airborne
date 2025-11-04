//
//  AJPApplicationConstants.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>

#ifndef AJPApplicationConstants_h
#define AJPApplicationConstants_h

@interface AJPApplicationConstants : NSObject

extern NSString *const JUSPAY_MANIFEST_DIR;
extern NSString *const JUSPAY_PACKAGE_DIR;
extern NSString *const JUSPAY_RESOURCE_DIR;

extern NSString *const JUSPAY_MAIN_DIR;
extern NSString *const JUSPAY_TEMP_DIR;

extern NSString *const APP_CONFIG_FILE_NAME;
extern NSString *const APP_PACKAGE_FILE_NAME;
extern NSString *const APP_RESOURCES_FILE_NAME;

extern NSString *const APP_CONFIG_DATA_FILE_NAME;

extern NSString *const APP_PACKAGE_DATA_FILE_NAME;
extern NSString *const APP_PACKAGE_DATA_TEMP_FILE_NAME;

extern NSString *const APP_RESOURCES_DATA_FILE_NAME;
extern NSString *const APP_OLD_RESOURCES_DATA_FILE_NAME;
extern NSString *const APP_TEMP_RESOURCES_DATA_FILE_NAME;

extern NSString *const BOOT_TIMEOUT_NOTIFICATION;
extern NSString *const PACKAGE_RESOURCE_NOTIFICATION;
extern NSString *const RELEASE_CONFIG_NOTIFICATION;
extern NSString *const LAZY_PACKAGE_NOTIFICATION;

extern NSString *const APPL_MANAGER_SUB_CAT;

// Backup and Rollback Constants
extern NSString *const JUSPAY_BACKUP_DIR;
extern NSString *const JUSPAY_BACKUP_TEMP_DIR;
extern NSString *const JUSPAY_BACKUP_MAIN_DIR;

extern NSString *const BACKUP_STAGE_KEY;
extern NSString *const BACKUP_INPLACE_KEY;
extern NSString *const ROLLBACK_IN_PROGRESS_KEY;
extern NSString *const BLACKLISTED_VERSIONS_KEY;

@end

#endif /* AJPApplicationConstants_h */

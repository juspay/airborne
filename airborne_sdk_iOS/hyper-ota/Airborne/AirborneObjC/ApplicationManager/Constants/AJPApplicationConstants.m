//
//  AJPApplicationConstants.m
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "AJPApplicationConstants.h"

@implementation AJPApplicationConstants

NSString *const JUSPAY_MANIFEST_DIR = @"JuspayManifests";
NSString *const JUSPAY_PACKAGE_DIR = @"JuspayPackages";
NSString *const JUSPAY_RESOURCE_DIR = @"JuspayResources";

NSString *const JUSPAY_MAIN_DIR = @"main";
NSString *const JUSPAY_TEMP_DIR = @"temp";

NSString *const APP_CONFIG_FILE_NAME = @"app-config.json";
NSString *const APP_PACKAGE_FILE_NAME = @"app-pkg.json";
NSString *const APP_RESOURCES_FILE_NAME = @"app-resources.json";

NSString *const APP_CONFIG_DATA_FILE_NAME = @"app-config.dat";

NSString *const APP_PACKAGE_DATA_FILE_NAME = @"app-pkg.dat";
NSString *const APP_PACKAGE_DATA_TEMP_FILE_NAME = @"app-pkg-temp.dat";

NSString *const APP_RESOURCES_DATA_FILE_NAME = @"app-resources.dat";
NSString *const APP_OLD_RESOURCES_DATA_FILE_NAME = @"app-resources-old.dat";
NSString *const APP_TEMP_RESOURCES_DATA_FILE_NAME = @"app-resources-temp.dat";

NSString *const BOOT_TIMEOUT_NOTIFICATION = @"AJPBootTimeoutNotification";
NSString *const PACKAGE_RESOURCE_NOTIFICATION = @"AJPPackageResourceNotification";
NSString *const RELEASE_CONFIG_NOTIFICATION = @"AJPReleaseConfigNotification";
NSString *const LAZY_PACKAGE_NOTIFICATION = @"AJPLazyPackageNotification";

NSString *const APPL_MANAGER_SUB_CAT = @"hyperota";

@end

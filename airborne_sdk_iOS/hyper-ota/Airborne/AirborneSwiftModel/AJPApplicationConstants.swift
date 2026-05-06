//
//  AJPApplicationConstants.swift
//  Airborne
//
//  Created by Balaganesh S on 27/04/26.
//


import Foundation

@objcMembers public class AJPApplicationConstants: NSObject {
    // MARK: - Directory Names
    public static let JUSPAY_MANIFEST_DIR = "JuspayManifests"
    public static let JUSPAY_PACKAGE_DIR = "JuspayPackages"
    public static let JUSPAY_RESOURCE_DIR = "JuspayResources"

    public static let JUSPAY_MAIN_DIR = "main"
    public static let JUSPAY_TEMP_DIR = "temp"

    // MARK: - File Names
    public static let APP_CONFIG_DATA_FILE_NAME = "app-config.dat"
    public static let APP_MANIFEST_DATA_TEMP_FILE_NAME = "app-manifest-temp.dat"

    public static let APP_PACKAGE_DATA_FILE_NAME = "app-pkg.dat"
    public static let APP_PACKAGE_DATA_TEMP_FILE_NAME = "app-pkg-temp.dat"

    public static let APP_RESOURCES_DATA_FILE_NAME = "app-resources.dat"
    public static let APP_OLD_RESOURCES_DATA_FILE_NAME = "app-resources-old.dat"
    public static let APP_TEMP_RESOURCES_DATA_FILE_NAME = "app-resources-temp.dat"

    // MARK: - Notification Names
    public static let BOOT_TIMEOUT_NOTIFICATION = Notification.Name("AJPBootTimeoutNotification")
    public static let PACKAGE_RESOURCE_NOTIFICATION = Notification.Name("AJPPackageResourceNotification")
    public static let RELEASE_CONFIG_NOTIFICATION = Notification.Name("AJPReleaseConfigNotification")
    public static let RELEASE_CONFIG_TIMEOUT_NOTIFICATION = Notification.Name("AJPReleaseConfigTimeoutNotification")
    public static let LAZY_PACKAGE_NOTIFICATION = Notification.Name("AJPLazyPackageNotification")

    // MARK: - Misc
    public static let APPL_MANAGER_SUB_CAT = "hyperota"
}

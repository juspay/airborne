//
//  AJPApplicationConstants.swift
//  Airborne
//
//  Created by Balaganesh S on 27/04/26.
//

import Foundation
#if SWIFT_PACKAGE
import AirborneSwiftCore
#endif

@objcMembers public class AJPApplicationConstants: NSObject {
    // MARK: - Directory Names
    // Prefixed with `AJPIdentity.storageDirectoryPrefix` (default keeps the historical names).
    public static var AIRBORNE_MANIFEST_DIR: String { "\(AJPIdentity.storageDirectoryPrefix)Manifests" }
    public static var AIRBORNE_PACKAGE_DIR: String { "\(AJPIdentity.storageDirectoryPrefix)Packages" }
    public static var AIRBORNE_RESOURCE_DIR: String { "\(AJPIdentity.storageDirectoryPrefix)Resources" }

    public static let AIRBORNE_MAIN_DIR = "main"
    public static let AIRBORNE_TEMP_DIR = "temp"

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

    // MARK: - UserDefaults Keys
    public static var APP_VERSION_USER_DEFAULTS_KEY: String { "\(AJPIdentity.identifierPrefix).airborne.appVersion" }

    // MARK: - Misc
    public static let APPL_MANAGER_SUB_CAT = "airborne"
}

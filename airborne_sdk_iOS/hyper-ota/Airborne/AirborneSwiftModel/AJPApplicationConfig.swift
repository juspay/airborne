//
//  AJPApplicationConfig.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation

/// The configuration portion of a release manifest.
/// Contains version info, timeouts, and arbitrary properties.
/// ObjC compatible, NSSecureCoding compliant.
@objcMembers public class AJPApplicationConfig: NSObject, NSSecureCoding {

    /// The config version string (e.g. "1.0.0").
    public var version: String

    /// The boot timeout in milliseconds. Defaults to 1000.
    public var bootTimeout: NSNumber

    /// The release config fetch timeout in milliseconds. Optional, defaults to 1000.
    public var releaseConfigTimeout: NSNumber?

    /// Arbitrary key-value properties from the manifest.
    public var properties: NSDictionary

    // MARK: - Initialization

    /// Creates a config with all defaults.
    /// Restores `NSObject.init()` for ObjC callers.
    public override init() {
        self.version = ""
        self.bootTimeout = NSNumber(value: 1000)
        self.releaseConfigTimeout = NSNumber(value: 1000)
        self.properties = NSDictionary()
        super.init()
    }

    /// Initializes a config from a manifest dictionary, falling back to defaults for missing/invalid fields.
    /// The `throws` signature is kept for Objective-C bridging (`initWithDictionary:error:`).
    /// - Parameter dictionary: A dictionary with `version`, `boot_timeout`, `release_config_timeout`, and `properties` keys.
    public init(dictionary: NSDictionary) throws {
        self.version = dictionary["version"] as? String ?? ""
        self.bootTimeout = dictionary["boot_timeout"] as? NSNumber ?? NSNumber(value: 1000)
        self.releaseConfigTimeout = dictionary["release_config_timeout"] as? NSNumber ?? NSNumber(value: 1000)
        self.properties = dictionary["properties"] as? NSDictionary ?? NSDictionary()
        super.init()
    }

    /// Serializes the config to a dictionary.
    public func toDictionary() -> NSDictionary {
        var dict: [String: Any] = [:]
        dict["version"] = version
        dict["boot_timeout"] = bootTimeout
        if let rct = releaseConfigTimeout {
            dict["release_config_timeout"] = rct
        }
        dict["properties"] = properties
        return dict as NSDictionary
    }

    // MARK: - NSSecureCoding

    @objc public class var supportsSecureCoding: Bool { true }

    public required init?(coder: NSCoder) {
        self.version = coder.decodeObject(of: NSString.self, forKey: "version") as String? ?? ""
        self.bootTimeout = coder.decodeObject(of: NSNumber.self, forKey: "boot_timeout") ?? NSNumber(value: 1000)
        self.releaseConfigTimeout = coder.decodeObject(of: NSNumber.self, forKey: "release_config_timeout")
        let propClasses: [AnyClass] = [NSDictionary.self, NSArray.self, NSString.self, NSNumber.self]
        self.properties = coder.decodeObject(of: propClasses, forKey: "properties") as? NSDictionary ?? NSDictionary()
        super.init()
    }

    public func encode(with coder: NSCoder) {
        coder.encode(version, forKey: "version")
        coder.encode(bootTimeout, forKey: "boot_timeout")
        coder.encode(releaseConfigTimeout, forKey: "release_config_timeout")
        coder.encode(properties, forKey: "properties")
    }
}

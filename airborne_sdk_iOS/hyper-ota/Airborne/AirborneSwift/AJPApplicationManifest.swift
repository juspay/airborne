//
//  AJPApplicationManifest.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation

/// The top-level release manifest, combining config, package, and resources.
/// Parsed from the release config JSON and persisted via NSSecureCoding.
/// ObjC compatible.
@objcMembers public class AJPApplicationManifest: NSObject, NSSecureCoding {

    // MARK: - Properties

    /// The application configuration (version, timeouts, properties).
    public var config: AJPApplicationConfig

    /// The package descriptor (index, important splits, lazy splits).
    public var package: AJPApplicationPackage

    /// The remote resource map keyed by filePath.
    public var resources: AJPApplicationResources

    // MARK: - Initialization

    /// Restores `NSObject.init()` for ObjC callers; creates an empty manifest.
    public override init() {
        self.config = AJPApplicationConfig()
        self.package = AJPApplicationPackage()
        self.resources = AJPApplicationResources()
        super.init()
    }

    /// Creates a manifest by composing already-parsed model objects.
    /// Used internally by `AJPApplicationManager` to snapshot the current state.
    public init(package: AJPApplicationPackage,
                config: AJPApplicationConfig,
                resources: AJPApplicationResources) {
        self.package = package
        self.config = config
        self.resources = resources
        super.init()
    }

    /// Parses a manifest from raw JSON data (the release config response body).
    /// Bridges to ObjC as `initWithData:error:`.
    /// Returns `nil` if the data cannot be deserialized as a JSON object.
    /// - Parameters:
    ///   - data: Raw UTF-8 JSON bytes.
    ///   - jsonError: On failure, set to the underlying JSON parse error.
    public init?(data: NSData, error jsonError: NSErrorPointer) {
        guard let dict = try? JSONSerialization.jsonObject(with: data as Data) as? [String: Any] else {
            if let ptr = jsonError {
                ptr.pointee = NSError(
                    domain: "ApplicationManifestError",
                    code: 500,
                    userInfo: [NSLocalizedDescriptionKey: "Invalid JSON or not a dictionary"]
                )
            }
            return nil
        }

        self.config = (try? AJPApplicationConfig(dictionary: (dict["config"] as? NSDictionary) ?? NSDictionary())) ?? AJPApplicationConfig()

        self.package = (try? AJPApplicationPackage(dictionary: (dict["package"] as? NSDictionary) ?? NSDictionary())) ?? AJPApplicationPackage()

        if let resourcesArray = dict["resources"] as? NSArray {
            self.resources = (try? AJPApplicationResources(resourcesArray: resourcesArray)) ?? AJPApplicationResources()
        } else {
            self.resources = AJPApplicationResources()
        }

        super.init()
    }

    // MARK: - Serialization

    /// Serializes the manifest back to a dictionary, mirroring the server JSON shape.
    public func toDictionary() -> NSDictionary {
        return [
            "config": config.toDictionary(),
            "package": package.toDictionary(),
            "resources": resources.toDictionary()
        ]
    }

    // MARK: - NSSecureCoding

    @objc public class var supportsSecureCoding: Bool { true }

    public required init?(coder: NSCoder) {
        self.config = coder.decodeObject(of: AJPApplicationConfig.self, forKey: "config") ?? AJPApplicationConfig()
        self.package = coder.decodeObject(of: AJPApplicationPackage.self, forKey: "package") ?? AJPApplicationPackage()
        self.resources = coder.decodeObject(of: AJPApplicationResources.self, forKey: "resources") ?? AJPApplicationResources()
        super.init()
    }

    public func encode(with coder: NSCoder) {
        coder.encode(config, forKey: "config")
        coder.encode(package, forKey: "package")
        coder.encode(resources, forKey: "resources")
    }
}

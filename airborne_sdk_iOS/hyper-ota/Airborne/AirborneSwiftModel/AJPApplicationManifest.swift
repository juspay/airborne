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

    /// The unresolved Superposition bundle, present only when the release config was served
    /// with `extended=true`. A top-level sibling of `config`/`package`/`resources`, not a wrapper.
    ///
    /// Backend-controlled and arbitrarily nested, so it is carried opaquely and never modelled:
    /// the SDK only stores and forwards it. `nil` for responses that predate the flag, in which
    /// case it is omitted from `toDictionary()` rather than emitted as null.
    public var unresolvedProperties: NSDictionary?

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
    public convenience init(package: AJPApplicationPackage,
                            config: AJPApplicationConfig,
                            resources: AJPApplicationResources) {
        self.init(package: package, config: config, resources: resources, unresolvedProperties: nil)
    }

    /// Creates a manifest by composing already-parsed model objects, carrying the opaque
    /// unresolved properties alongside them.
    public init(package: AJPApplicationPackage,
                config: AJPApplicationConfig,
                resources: AJPApplicationResources,
                unresolvedProperties: NSDictionary?) {
        self.package = package
        self.config = config
        self.resources = resources
        self.unresolvedProperties = unresolvedProperties
        super.init()
    }

    /// Parses a manifest from raw JSON data (the release config response body).
    /// Bridges to ObjC as `initWithData:error:`.
    /// Returns `nil` if the data cannot be deserialized as a JSON object.
    /// - Parameters:
    ///   - data: Raw UTF-8 JSON bytes.
    /// Throws error if JSON parse fails on the data.
    public init(data: NSData) throws {
        guard let dict = try? JSONSerialization.jsonObject(with: data as Data) as? [String: Any] else {
            throw NSError(
                domain: "ApplicationManifestError",
                code: 500,
                userInfo: [NSLocalizedDescriptionKey: "Invalid JSON or not a dictionary"]
            )
        }

        self.config = (try? AJPApplicationConfig(dictionary: (dict["config"] as? NSDictionary) ?? NSDictionary())) ?? AJPApplicationConfig()

        self.package = (try? AJPApplicationPackage(dictionary: (dict["package"] as? NSDictionary) ?? NSDictionary())) ?? AJPApplicationPackage()

        if let resourcesArray = dict["resources"] as? NSArray {
            self.resources = (try? AJPApplicationResources(resourcesArray: resourcesArray)) ?? AJPApplicationResources()
        } else {
            self.resources = AJPApplicationResources()
        }

        // Kept verbatim: the inner structure is backend-owned, so it is neither parsed nor validated.
        self.unresolvedProperties = dict["unresolved_properties"] as? NSDictionary

        super.init()
    }

    // MARK: - Serialization

    /// Serializes the manifest back to a dictionary, mirroring the server JSON shape.
    public func toDictionary() -> NSDictionary {
        var dict: [String: Any] = [
            "config": config.toDictionary(),
            "package": package.toDictionary(),
            "resources": resources.toDictionary()
        ]
        // Omitted entirely when absent — never serialized as null.
        if let unresolvedProperties = unresolvedProperties {
            dict["unresolved_properties"] = unresolvedProperties
        }
        return dict as NSDictionary
    }

    // MARK: - NSSecureCoding

    @objc public class var supportsSecureCoding: Bool { true }

    public required init?(coder: NSCoder) {
        self.config = coder.decodeObject(of: AJPApplicationConfig.self, forKey: "config") ?? AJPApplicationConfig()
        self.package = coder.decodeObject(of: AJPApplicationPackage.self, forKey: "package") ?? AJPApplicationPackage()
        self.resources = coder.decodeObject(of: AJPApplicationResources.self, forKey: "resources") ?? AJPApplicationResources()
        // NSNull is allowed alongside the usual JSON classes: the payload is backend-controlled,
        // and a single null anywhere inside it would otherwise fail the whole manifest decode.
        let unresolvedClasses: [AnyClass] = [NSDictionary.self, NSArray.self, NSString.self, NSNumber.self, NSNull.self]
        self.unresolvedProperties = coder.decodeObject(of: unresolvedClasses, forKey: "unresolved_properties") as? NSDictionary
        super.init()
    }

    public func encode(with coder: NSCoder) {
        coder.encode(config, forKey: "config")
        coder.encode(package, forKey: "package")
        coder.encode(resources, forKey: "resources")
        coder.encode(unresolvedProperties, forKey: "unresolved_properties")
    }
}

//
//  AJPApplicationResources.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation

/// A collection of named remote resources from a release manifest.
/// Stored internally as a `[String: AJPResource]` keyed by the resource's `filePath`.
/// ObjC compatible, NSSecureCoding compliant.
@objcMembers public class AJPApplicationResources: NSObject, NSSecureCoding {

    /// All resources keyed by their `filePath`.
    public var resources: [String: AJPResource]

    // MARK: - Initialization

    /// Creates an empty resources collection.
    /// Required to restore `NSObject.init()` visibility for ObjC callers who build resources manually
    /// e.g. `[[AJPApplicationResources alloc] init]; appResources.resources = dict;`
    public override init() {
        self.resources = [:]
        super.init()
    }

    /// Initializes resources from an **array** of resource dictionaries.
    /// The ObjC manifest JSON represents resources as an array, not a keyed dict.
    /// Each entry is parsed as an `AJPResource` and keyed by its `filePath`.
    ///
    /// Bridges to ObjC as `initWithDictionary:error:` for backwards compatibility.
    /// - Parameter resourcesArray: An array of resource dictionaries, each with `url`, `file_path`, and optional `checksum`.
    /// - Throws: An `NSError` if the root value is not iterable.
    @objc(initWithDictionary:error:)
    public init(resourcesArray: NSArray) throws {
        var parsed: [String: AJPResource] = [:]
        for item in resourcesArray {
            guard let dict = item as? NSDictionary else { continue }
            if let resource = try? AJPResource(dictionary: dict) {
                parsed[resource.filePath] = resource
            }
        }
        self.resources = parsed
        super.init()
    }

    /// Serializes the resources back to an array of resource dictionaries.
    /// Returns `NSArray` to match the expected ObjC JSON shape.
    public func toDictionary() -> NSArray {
        return resources.values.map { $0.toDictionary() } as NSArray
    }

    // MARK: - NSSecureCoding

    @objc public class var supportsSecureCoding: Bool { true }

    public required init?(coder: NSCoder) {
        let classes: [AnyClass] = [NSDictionary.self, NSString.self, NSArray.self, NSNumber.self, AJPResource.self]
        guard let decoded = coder.decodeObject(of: classes, forKey: "resources") as? [String: AJPResource] else {
            self.resources = [:]
            super.init()
            return
        }
        self.resources = decoded
        super.init()
    }

    public func encode(with coder: NSCoder) {
        coder.encode(resources, forKey: "resources")
    }
}

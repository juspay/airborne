//
//  AJPApplicationPackage.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation

/// The package entry in a release manifest.
/// Describes the index resource, important (eager) splits, and lazy splits.
/// ObjC compatible, NSSecureCoding compliant.
@objcMembers public class AJPApplicationPackage: NSObject, NSSecureCoding {

    /// The unique name of the package (e.g. "merchant-app").
    public var name: String

    /// The version string of this package.
    public var version: String

    /// The main index resource (entry point file).
    public var index: AJPResource

    /// Arbitrary key-value properties from the manifest.
    public var properties: NSDictionary

    /// Eagerly downloaded resources, including the index.
    public var important: [AJPResource]

    /// Lazily downloaded resources.
    public var lazy: [AJPLazyResource]

    // MARK: - Initialization

    /// Creates a package with all-empty defaults.
    /// Restores `NSObject.init()` for ObjC callers.
    public override init() {
        self.name = ""
        self.version = ""
        self.properties = NSDictionary()
        // Use a placeholder resource — URL(string: "") returns nil so we use about:blank
        self.index = AJPResource(url: URL(string: "about:blank")!, filePath: "", checksum: nil)
        self.important = []
        self.lazy = []
        super.init()
    }

    /// Initializes a package from a manifest dictionary.
    /// Bridges to ObjC as `initWithDictionary:error:`.
    /// Missing or invalid fields fall back to empty defaults.
    /// - Parameter dictionary: A dictionary with `name`, `version`, `index`, `important`, and `lazy` keys.
    /// - Throws: An `NSError` if the root value is not a valid dictionary.
    public init(dictionary: NSDictionary) throws {
        self.name = dictionary["name"] as? String ?? ""
        self.version = dictionary["version"] as? String ?? ""
        self.properties = dictionary["properties"] as? NSDictionary ?? NSDictionary()

        // Parse index resource — fall back to a placeholder if missing or invalid
        if let indexDict = dictionary["index"] as? NSDictionary,
           let indexResource = try? AJPResource(dictionary: indexDict) {
            self.index = indexResource
        } else {
            self.index = AJPResource(url: URL(string: "about:blank")!, filePath: "", checksum: nil)
        }

        // Parse important (eager) resources
        if let importantArray = dictionary["important"] as? [NSDictionary] {
            self.important = importantArray.compactMap { try? AJPResource(dictionary: $0) }
        } else {
            self.important = []
        }

        // Parse lazy resources
        if let lazyArray = dictionary["lazy"] as? [NSDictionary] {
            self.lazy = lazyArray.compactMap { try? AJPLazyResource(dictionary: $0) }
        } else {
            self.lazy = []
        }

        super.init()
    }

    // MARK: - Split Accessors

    /// Returns the index resource plus all important split resources.
    public func allImportantSplits() -> [AJPResource] {
        return [index] + important
    }

    /// Returns all lazy split resources.
    public func allLazySplits() -> [AJPResource] {
        return lazy
    }

    /// Returns all resources (index + important + lazy).
    public func allSplits() -> [AJPResource] {
        return allImportantSplits() + allLazySplits()
    }

    /// Returns the absolute URL strings of all important splits (including index) as a set.
    /// Returns nil if any resource has no valid URL.
    public func allImportantSplitsAsSet() -> Set<String>? {
        var result = Set<String>()
        result.insert(index.url.absoluteString)
        for resource in important {
            result.insert(resource.url.absoluteString)
        }
        return result
    }

    /// Returns the absolute URL strings of all lazy splits as a set.
    /// Returns nil if any resource has no valid URL.
    public func allLazySplitsAsSet() -> Set<String>? {
        var result = Set<String>()
        for resource in lazy {
            result.insert(resource.url.absoluteString)
        }
        return result
    }

    /// Returns the absolute URL strings of all splits as a set.
    public func allSplitsAsSet() -> Set<String>? {
        guard let important = allImportantSplitsAsSet(),
              let lazy = allLazySplitsAsSet() else { return nil }
        return important.union(lazy)
    }

    /// Serializes the package to a dictionary.
    public func toDictionary() -> NSDictionary {
        let importantDicts = important.map { $0.toDictionary() }
        let lazyDicts = lazy.map { $0.toDictionary() }
        return [
            "name": name,
            "version": version,
            "index": index.toDictionary(),
            "properties": properties,
            "important": importantDicts,
            "lazy": lazyDicts
        ]
    }

    // MARK: - NSSecureCoding

    @objc public class var supportsSecureCoding: Bool { true }

    public required init?(coder: NSCoder) {
        let stringClasses: [AnyClass] = [NSString.self]
        self.name = coder.decodeObject(of: stringClasses, forKey: "name") as? String ?? ""
        self.version = coder.decodeObject(of: stringClasses, forKey: "version") as? String ?? ""

        let propClasses: [AnyClass] = [NSDictionary.self, NSArray.self, NSString.self, NSNumber.self]
        self.properties = coder.decodeObject(of: propClasses, forKey: "properties") as? NSDictionary ?? NSDictionary()

        if let idx = coder.decodeObject(of: AJPResource.self, forKey: "index") {
            self.index = idx
        } else {
            self.index = AJPResource(url: URL(string: "about:blank")!, filePath: "", checksum: nil)
        }

        let resourceArrayClasses: [AnyClass] = [NSArray.self, AJPResource.self]
        let importantObjs = coder.decodeObject(of: resourceArrayClasses, forKey: "important") as? [Any] ?? []
        self.important = importantObjs.compactMap { $0 as? AJPResource }

        let lazyArrayClasses: [AnyClass] = [NSArray.self, AJPResource.self, AJPLazyResource.self]
        let lazyObjs = coder.decodeObject(of: lazyArrayClasses, forKey: "lazy") as? [Any] ?? []
        self.lazy = lazyObjs.compactMap { item -> AJPLazyResource? in
            if let lr = item as? AJPLazyResource { return lr }
            if let r = item as? AJPResource { return AJPLazyResource(resource: r) }
            return nil
        }

        super.init()
    }

    public func encode(with coder: NSCoder) {
        coder.encode(name, forKey: "name")
        coder.encode(version, forKey: "version")
        coder.encode(index, forKey: "index")
        coder.encode(properties, forKey: "properties")
        coder.encode(important, forKey: "important")
        coder.encode(lazy, forKey: "lazy")
    }
}

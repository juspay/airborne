//
//  AJPResource.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation

/// A resource entry in a release manifest, describing a remote file's URL, local path, and optional checksum.
/// This class is NSSecureCoding-compliant and Objective-C compatible.
@objcMembers public class AJPResource: NSObject, NSSecureCoding {

    /// The remote URL of the resource file.
    public let url: URL

    /// The local relative file path where the resource should be stored.
    public let filePath: String

    /// An optional SHA256 checksum string for integrity verification.
    public let checksum: String?

    // MARK: - Initialization

    /// Initializes a resource from a manifest dictionary.
    /// Bridges to ObjC as `initWithDictionary:error:`.
    /// - Parameter dictionary: A dictionary with `url`, `file_path`, and optionally `checksum` keys.
    /// - Throws: An `NSError` if required fields are missing or invalid.
    public init(dictionary: NSDictionary) throws {
        guard let urlString = dictionary["url"] as? String,
              let parsedURL = URL(string: urlString),
              parsedURL.scheme != nil else {
            throw NSError(
                domain: "ResourceError",
                code: 401,
                userInfo: [NSLocalizedDescriptionKey: "Invalid URL"]
            )
        }

        guard let filePath = dictionary["file_path"] as? String else {
            throw NSError(
                domain: "ResourceError",
                code: 402,
                userInfo: [NSLocalizedDescriptionKey: "Invalid filePath"]
            )
        }

        if let checksum = dictionary["checksum"], !(checksum is NSNull), !(checksum is String) {
            throw NSError(
                domain: "ResourceError",
                code: 403,
                userInfo: [NSLocalizedDescriptionKey: "Invalid checksum"]
            )
        }

        self.url = parsedURL
        self.filePath = filePath
        self.checksum = dictionary["checksum"] as? String
        super.init()
    }

    /// Internal initializer for programmatic creation (e.g. placeholders) where a URL is already known.
    /// Not exposed to ObjC — Swift callers only.
    internal init(url: URL, filePath: String, checksum: String? = nil) {
        self.url = url
        self.filePath = filePath
        self.checksum = checksum
        super.init()
    }

    /// Serializes this resource back to a dictionary representation.
    public func toDictionary() -> NSDictionary {
        var dict: [String: Any] = [
            "url": url.absoluteString,
            "file_path": filePath
        ]
        if let checksum = checksum {
            dict["checksum"] = checksum
        }
        return dict as NSDictionary
    }

    // MARK: - NSSecureCoding

    /// Must be `class var` (not `static var`) so subclasses can override it.
    /// The ObjC runtime requires any subclass that overrides `initWithCoder:` to
    /// also explicitly override `+supportsSecureCoding`.
    @objc public class var supportsSecureCoding: Bool { true }

    public required init?(coder: NSCoder) {
        let urlObj = coder.decodeObject(of: [NSURL.self, NSString.self], forKey: "url")

        if let nsurl = urlObj as? NSURL, let swiftURL = nsurl as URL? {
            self.url = swiftURL
        } else if let urlString = urlObj as? String, let parsedURL = URL(string: urlString) {
            self.url = parsedURL
        } else {
            return nil
        }

        guard let filePath = coder.decodeObject(of: NSString.self, forKey: "file_path") as String? else {
            return nil
        }
        self.filePath = filePath
        self.checksum = coder.decodeObject(of: NSString.self, forKey: "checksum") as String?
        super.init()
    }

    public func encode(with coder: NSCoder) {
        coder.encode(url as NSURL, forKey: "url")
        coder.encode(filePath, forKey: "file_path")
        if let checksum = checksum {
            coder.encode(checksum, forKey: "checksum")
        }
    }
}

/// A lazily-loaded variant of `AJPResource` with a tracked download state.
@objcMembers public class AJPLazyResource: AJPResource {

    /// Whether this resource has already been downloaded to local storage.
    public var isDownloaded: Bool

    // MARK: - Initialization

    /// Creates a lazy resource by copying the base properties of an existing `AJPResource`.
    /// - Parameter resource: The resource to copy.
    public convenience init(resource: AJPResource) {
        // Build a dictionary from the base resource and delegate to the throwing init.
        // Force-try is safe here because we're round-tripping a valid AJPResource.
        try! self.init(dictionary: resource.toDictionary())
    }

    /// Initializes a lazy resource from a manifest dictionary, reading `isDownloaded` in addition to base fields.
    /// Bridges to ObjC as `initWithDictionary:error:`.
    public override init(dictionary: NSDictionary) throws {
        self.isDownloaded = (dictionary["isDownloaded"] as? Bool) ?? false
        try super.init(dictionary: dictionary)
    }

    /// Serializes this lazy resource to a dictionary, adding `isDownloaded` to the base fields.
    public override func toDictionary() -> NSDictionary {
        let dict = super.toDictionary().mutableCopy() as! NSMutableDictionary
        dict["isDownloaded"] = isDownloaded
        return dict
    }

    // MARK: - NSSecureCoding
    // Explicitly overridden — required by the ObjC runtime whenever a subclass
    // overrides `initWithCoder:`, even if the superclass already returns YES.
    @objc public override class var supportsSecureCoding: Bool { true }

    public required init?(coder: NSCoder) {
        self.isDownloaded = coder.decodeBool(forKey: "isDownloaded")
        super.init(coder: coder)
    }

    public override func encode(with coder: NSCoder) {
        super.encode(with: coder)
        coder.encode(isDownloaded, forKey: "isDownloaded")
    }
}

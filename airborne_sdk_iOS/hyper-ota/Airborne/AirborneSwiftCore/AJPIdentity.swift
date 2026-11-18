//
//  AJPIdentity.swift
//  Airborne
//

import Foundation

/// Process-wide identifiers the SDK stamps on things a host app or its users can observe:
/// NSError domains, dispatch queue labels (visible in crash reports), UserDefaults keys
/// and the on-disk storage directory names.
///
/// Override these **before** creating the first `AirborneServices` instance (or implement
/// `AirborneDelegate.identifierPrefix()` / `storageDirectoryPrefix()`, which set them for you).
/// Changing them afterwards is not supported: queue labels are fixed on first use, and a
/// different storage prefix points the SDK at a different, empty set of directories.
///
/// - Note: The defaults match the identifiers used by earlier SDK versions, so existing installs
///   keep their downloads. Changing `storageDirectoryPrefix` for an app that already shipped with
///   another value discards previously downloaded packages (they remain under the old directories
///   and are downloaded again).
@objcMembers public final class AJPIdentity: NSObject {

    public static let defaultIdentifierPrefix = "in.juspay"
    public static let defaultStorageDirectoryPrefix = "Juspay"

    private static let lock = NSLock()
    private static var _identifierPrefix = defaultIdentifierPrefix
    private static var _storageDirectoryPrefix = defaultStorageDirectoryPrefix

    /// Reverse-DNS prefix, e.g. `"com.example"`. Used to build error domains
    /// (`<prefix>.Airborne`), queue labels and UserDefaults keys.
    /// Empty / whitespace-only values are ignored.
    public static var identifierPrefix: String {
        get { lock.lock(); defer { lock.unlock() }; return _identifierPrefix }
        set {
            let value = newValue.trimmingCharacters(in: CharacterSet(charactersIn: " \n\t."))
            guard !value.isEmpty else { return }
            lock.lock(); _identifierPrefix = value; lock.unlock()
        }
    }

    /// Prefix of the directories created in the app's Library folder,
    /// e.g. `"Example"` → `ExampleManifests`, `ExamplePackages`, `ExampleResources`.
    /// Empty values or values containing a path separator are ignored.
    public static var storageDirectoryPrefix: String {
        get { lock.lock(); defer { lock.unlock() }; return _storageDirectoryPrefix }
        set {
            let value = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty, !value.contains("/") else { return }
            lock.lock(); _storageDirectoryPrefix = value; lock.unlock()
        }
    }

    /// NSError domain for errors raised by the SDK: `<identifierPrefix>.Airborne`.
    public static var errorDomain: String { "\(identifierPrefix).Airborne" }

    /// Builds a namespaced identifier: `<identifierPrefix>.Airborne.<suffix>`.
    public static func qualified(_ suffix: String) -> String { "\(errorDomain).\(suffix)" }

    /// Restores the defaults. Intended for tests.
    public static func reset() {
        lock.lock()
        _identifierPrefix = defaultIdentifierPrefix
        _storageDirectoryPrefix = defaultStorageDirectoryPrefix
        lock.unlock()
    }
}

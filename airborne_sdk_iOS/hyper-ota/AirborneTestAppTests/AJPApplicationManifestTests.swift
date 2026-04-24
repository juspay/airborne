//
//  AJPApplicationManifestTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

final class AJPApplicationManifestTests: XCTestCase {

    // MARK: - Helpers

    func makeManifestJSON() -> Data {
        let json: [String: Any] = [
            "config": [
                "version": "1.0.0",
                "boot_timeout": 3000,
                "release_config_timeout": 2000,
                "properties": ["env": "prod"]
            ],
            "package": [
                "name": "my-app",
                "version": "2.0.0",
                "index": ["url": "https://cdn.example.com/index.js", "file_path": "main/index.js"],
                "important": [
                    ["url": "https://cdn.example.com/vendor.js", "file_path": "main/vendor.js"]
                ],
                "lazy": []
            ],
            "resources": [
                ["url": "https://cdn.example.com/image.png", "file_path": "assets/image.png", "checksum": "abc"]
            ]
        ]
        return try! JSONSerialization.data(withJSONObject: json)
    }

    // MARK: - Init from Data

    func testInitWithValidData() throws {
        let manifest = AJPApplicationManifest(data: makeManifestJSON() as NSData, error: nil)

        XCTAssertNotNil(manifest)
        XCTAssertEqual(manifest?.config.version, "1.0.0")
        XCTAssertEqual(manifest?.config.bootTimeout, NSNumber(value: 3000))
        XCTAssertEqual(manifest?.package.name, "my-app")
        XCTAssertEqual(manifest?.package.version, "2.0.0")
        XCTAssertEqual(manifest?.package.index.filePath, "main/index.js")
        XCTAssertEqual(manifest?.package.important.count, 1)
        XCTAssertEqual(manifest?.resources.resources.count, 1)
        XCTAssertNotNil(manifest?.resources.resources["assets/image.png"])
    }

    func testInitWithInvalidDataReturnsNil() {
        let badData = "not json at all".data(using: .utf8)! as NSData
        var error: NSError?
        let manifest = AJPApplicationManifest(data: badData, error: &error)

        XCTAssertNil(manifest)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.domain, "ApplicationManifestError")
        XCTAssertEqual(error?.code, 500)
    }

    func testInitWithNonDictionaryJSONReturnsNil() {
        // JSON root is an array, not an object
        let arrayData = try! JSONSerialization.data(withJSONObject: ["a", "b"])
        var error: NSError?
        let manifest = AJPApplicationManifest(data: arrayData as NSData, error: &error)

        XCTAssertNil(manifest)
        XCTAssertNotNil(error)
    }

    // MARK: - Composed Init

    func testInitWithComponents() throws {
        let config = try AJPApplicationConfig(dictionary: ["version": "1.0"])
        let package = try AJPApplicationPackage(dictionary: ["name": "app", "version": "1.0"])
        let resources = try AJPApplicationResources(resourcesArray: NSArray())

        let manifest = AJPApplicationManifest(package: package, config: config, resources: resources)

        XCTAssertEqual(manifest.config.version, "1.0")
        XCTAssertEqual(manifest.package.name, "app")
        XCTAssertEqual(manifest.resources.resources.count, 0)
    }

    // MARK: - toDictionary

    func testToDictionaryShape() {
        let manifest = AJPApplicationManifest(data: makeManifestJSON() as NSData, error: nil)!
        let dict = manifest.toDictionary()

        XCTAssertNotNil(dict["config"])
        XCTAssertNotNil(dict["package"])
        XCTAssertNotNil(dict["resources"])

        let configDict = dict["config"] as? NSDictionary
        XCTAssertEqual(configDict?["version"] as? String, "1.0.0")

        let packageDict = dict["package"] as? NSDictionary
        XCTAssertEqual(packageDict?["name"] as? String, "my-app")
    }

    // MARK: - NSSecureCoding

    func testSecureCodingRoundTrip() throws {
        let manifest = AJPApplicationManifest(data: makeManifestJSON() as NSData, error: nil)!

        let data = try NSKeyedArchiver.archivedData(withRootObject: manifest, requiringSecureCoding: true)
        let decoded = try NSKeyedUnarchiver.unarchivedObject(ofClass: AJPApplicationManifest.self, from: data)

        XCTAssertEqual(decoded?.config.version, "1.0.0")
        XCTAssertEqual(decoded?.package.name, "my-app")
        XCTAssertEqual(decoded?.package.version, "2.0.0")
        XCTAssertEqual(decoded?.resources.resources.count, 1)
    }

    func testSupportsSecureCoding() {
        XCTAssertTrue(AJPApplicationManifest.supportsSecureCoding)
    }

    // MARK: - Missing fields fall back gracefully

    func testMissingConfigFallsBackToDefault() {
        let json: [String: Any] = [
            "package": ["name": "app", "version": "1.0"],
            "resources": []
        ]
        let data = try! JSONSerialization.data(withJSONObject: json) as NSData
        let manifest = AJPApplicationManifest(data: data, error: nil)

        XCTAssertNotNil(manifest)
        XCTAssertEqual(manifest?.config.version, "")          // default
        XCTAssertEqual(manifest?.config.bootTimeout, NSNumber(value: 1000)) // default
    }
}

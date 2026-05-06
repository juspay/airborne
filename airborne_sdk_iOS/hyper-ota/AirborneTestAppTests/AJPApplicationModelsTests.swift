//
//  AJPApplicationModelsTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

// MARK: - AJPApplicationConfig Tests

final class AJPApplicationConfigTests: XCTestCase {

    func testInitWithFullDictionary() throws {
        let dict: NSDictionary = [
            "version": "2.0.0",
            "boot_timeout": 5000,
            "release_config_timeout": 3000,
            "properties": ["env": "prod"]
        ]
        let config = try AJPApplicationConfig(dictionary: dict)

        XCTAssertEqual(config.version, "2.0.0")
        XCTAssertEqual(config.bootTimeout, NSNumber(value: 5000))
        XCTAssertEqual(config.releaseConfigTimeout, NSNumber(value: 3000))
        XCTAssertEqual(config.properties["env"] as? String, "prod")
    }

    func testInitUsesDefaultsForMissingFields() throws {
        let config = try AJPApplicationConfig(dictionary: [:])

        XCTAssertEqual(config.version, "")
        XCTAssertEqual(config.bootTimeout, NSNumber(value: 1000))
        XCTAssertEqual(config.releaseConfigTimeout, NSNumber(value: 1000))
        XCTAssertEqual(config.properties.count, 0)
    }

    func testToDictionaryRoundTrip() throws {
        let dict: NSDictionary = [
            "version": "1.5.0",
            "boot_timeout": 2000,
            "release_config_timeout": 1500,
            "properties": ["key": "value"]
        ]
        let config = try AJPApplicationConfig(dictionary: dict)
        let serialized = config.toDictionary()

        XCTAssertEqual(serialized["version"] as? String, "1.5.0")
        XCTAssertEqual(serialized["boot_timeout"] as? NSNumber, NSNumber(value: 2000))
        XCTAssertEqual(serialized["release_config_timeout"] as? NSNumber, NSNumber(value: 1500))
    }

    func testSecureCodingRoundTrip() throws {
        let dict: NSDictionary = [
            "version": "3.0.0",
            "boot_timeout": 4000,
            "release_config_timeout": 2000,
            "properties": ["mode": "test"]
        ]
        let config = try AJPApplicationConfig(dictionary: dict)

        let data = try NSKeyedArchiver.archivedData(withRootObject: config, requiringSecureCoding: true)
        let decoded = try NSKeyedUnarchiver.unarchivedObject(ofClass: AJPApplicationConfig.self, from: data)

        XCTAssertEqual(decoded?.version, "3.0.0")
        XCTAssertEqual(decoded?.bootTimeout, NSNumber(value: 4000))
        XCTAssertEqual(decoded?.releaseConfigTimeout, NSNumber(value: 2000))
    }

    func testSupportsSecureCoding() {
        XCTAssertTrue(AJPApplicationConfig.supportsSecureCoding)
    }
}

// MARK: - AJPApplicationPackage Tests

final class AJPApplicationPackageTests: XCTestCase {

    func makePackageDict() -> NSDictionary {
        return [
            "name": "my-app",
            "version": "1.0.0",
            "index": ["url": "https://cdn.example.com/index.js", "file_path": "main/index.js"],
            "properties": ["key": "value"],
            "important": [
                ["url": "https://cdn.example.com/vendor.js", "file_path": "main/vendor.js"]
            ],
            "lazy": [
                ["url": "https://cdn.example.com/settings.js", "file_path": "main/settings.js", "isDownloaded": false]
            ]
        ]
    }

    func testInitWithFullDictionary() throws {
        let pkg = try AJPApplicationPackage(dictionary: makePackageDict())

        XCTAssertEqual(pkg.name, "my-app")
        XCTAssertEqual(pkg.version, "1.0.0")
        XCTAssertEqual(pkg.index.filePath, "main/index.js")
        XCTAssertEqual(pkg.important.count, 1)
        XCTAssertEqual(pkg.lazy.count, 1)
    }

    func testInitUsesDefaultsForMissingFields() throws {
        let pkg = try AJPApplicationPackage(dictionary: [:])

        XCTAssertEqual(pkg.name, "")
        XCTAssertEqual(pkg.version, "")
        // index falls back to an about:blank placeholder — never nil
        XCTAssertEqual(pkg.index.filePath, "")
        XCTAssertEqual(pkg.important, [])
        XCTAssertEqual(pkg.lazy, [])
    }

    func testAllImportantSplitsIncludesIndex() throws {
        let pkg = try AJPApplicationPackage(dictionary: makePackageDict())
        let splits = pkg.allImportantSplits()

        // index (1) + 1 important = 2
        XCTAssertEqual(splits.count, 2)
        XCTAssertTrue(splits.contains { $0.filePath == "main/index.js" })
        XCTAssertTrue(splits.contains { $0.filePath == "main/vendor.js" })
    }

    func testAllLazySplits() throws {
        let pkg = try AJPApplicationPackage(dictionary: makePackageDict())
        XCTAssertEqual(pkg.allLazySplits().count, 1)
        XCTAssertEqual(pkg.allLazySplits().first?.filePath, "main/settings.js")
    }

    func testAllSplitsCombinesAll() throws {
        let pkg = try AJPApplicationPackage(dictionary: makePackageDict())
        XCTAssertEqual(pkg.allSplits().count, 3) // index + 1 important + 1 lazy
    }

    func testAllImportantSplitsAsSet() throws {
        let pkg = try AJPApplicationPackage(dictionary: makePackageDict())
        let set = pkg.allImportantSplitsAsSet()

        XCTAssertNotNil(set)
        XCTAssertTrue(set!.contains("https://cdn.example.com/index.js"))
        XCTAssertTrue(set!.contains("https://cdn.example.com/vendor.js"))
    }

    func testToDictionaryRoundTrip() throws {
        let pkg = try AJPApplicationPackage(dictionary: makePackageDict())
        let dict = pkg.toDictionary()

        XCTAssertEqual(dict["name"] as? String, "my-app")
        XCTAssertEqual(dict["version"] as? String, "1.0.0")
        XCTAssertNotNil(dict["index"])
        XCTAssertEqual((dict["important"] as? [Any])?.count, 1)
        XCTAssertEqual((dict["lazy"] as? [Any])?.count, 1)
    }

    func testSecureCodingRoundTrip() throws {
        let pkg = try AJPApplicationPackage(dictionary: makePackageDict())
        
        let data = try NSKeyedArchiver.archivedData(withRootObject: pkg, requiringSecureCoding: true)
        let decoded = try NSKeyedUnarchiver.unarchivedObject(ofClass: AJPApplicationPackage.self, from: data)
        
        XCTAssertEqual(decoded?.name, "my-app")
        XCTAssertEqual(decoded?.version, "1.0.0")
        XCTAssertEqual(decoded?.important.count, 1)
        XCTAssertEqual(decoded?.lazy.count, 1)
    }
}

// MARK: - AJPApplicationResources Tests

final class AJPApplicationResourcesTests: XCTestCase {

    func makeResourcesArray() -> NSArray {
        return [
            ["url": "https://cdn.example.com/a.js", "file_path": "main/a.js", "checksum": "abc"],
            ["url": "https://cdn.example.com/b.js", "file_path": "main/b.js"]
        ]
    }

    func testInitWithResourcesArray() throws {
        let res = try AJPApplicationResources(resourcesArray: makeResourcesArray())

        XCTAssertEqual(res.resources.count, 2)
        XCTAssertNotNil(res.resources["main/a.js"])
        XCTAssertNotNil(res.resources["main/b.js"])
    }

    func testChecksumPreserved() throws {
        let res = try AJPApplicationResources(resourcesArray: makeResourcesArray())
        XCTAssertEqual(res.resources["main/a.js"]?.checksum, "abc")
        XCTAssertNil(res.resources["main/b.js"]?.checksum)
    }

    func testToDictionaryReturnsArray() throws {
        let res = try AJPApplicationResources(resourcesArray: makeResourcesArray())
        let serialized = res.toDictionary()

        XCTAssertTrue(serialized is NSArray)
        XCTAssertEqual((serialized as! [Any]).count, 2)
    }

    func testEmptyArrayProducesEmptyResources() throws {
        let res = try AJPApplicationResources(resourcesArray: NSArray())
        XCTAssertEqual(res.resources.count, 0)
    }

    func testSecureCodingRoundTrip() throws {
        let res = try AJPApplicationResources(resourcesArray: makeResourcesArray())

        let data = try NSKeyedArchiver.archivedData(withRootObject: res, requiringSecureCoding: true)
        let decoded = try NSKeyedUnarchiver.unarchivedObject(ofClass: AJPApplicationResources.self, from: data)

        XCTAssertEqual(decoded?.resources.count, 2)
        XCTAssertNotNil(decoded?.resources["main/a.js"])
    }

    func testSupportsSecureCoding() {
        XCTAssertTrue(AJPApplicationResources.supportsSecureCoding)
    }
}

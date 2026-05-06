//
//  AJPResourceTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

final class AJPResourceTests: XCTestCase {

    // MARK: - AJPResource Init Tests

    func testInitWithValidDictionary() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js",
            "checksum": "abc123"
        ]
        let resource = try AJPResource(dictionary: dict)

        XCTAssertEqual(resource.url.absoluteString, "https://example.com/index.js")
        XCTAssertEqual(resource.filePath, "main/index.js")
        XCTAssertEqual(resource.checksum, "abc123")
    }

    func testInitWithoutChecksum() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js"
        ]
        let resource = try AJPResource(dictionary: dict)
        XCTAssertNil(resource.checksum)
    }

    func testInitThrowsOnMissingURL() {
        let dict: NSDictionary = ["file_path": "main/index.js"]
        XCTAssertThrowsError(try AJPResource(dictionary: dict)) { error in
            let nsError = error as NSError
            XCTAssertEqual(nsError.domain, "ResourceError")
            XCTAssertEqual(nsError.code, 401)
        }
    }

    func testInitThrowsOnRelativeURL() {
        // URL(string:) succeeds but scheme is nil — rejected by parsedURL.scheme != nil check
        let dict: NSDictionary = ["url": "not a url", "file_path": "main/index.js"]
        XCTAssertThrowsError(try AJPResource(dictionary: dict)) { error in
            let nsError = error as NSError
            XCTAssertEqual(nsError.domain, "ResourceError")
            XCTAssertEqual(nsError.code, 401)
        }
    }

    func testInitThrowsOnMissingFilePath() {
        let dict: NSDictionary = ["url": "https://example.com/index.js"]
        XCTAssertThrowsError(try AJPResource(dictionary: dict)) { error in
            let nsError = error as NSError
            XCTAssertEqual(nsError.domain, "ResourceError")
            XCTAssertEqual(nsError.code, 402)
        }
    }

    func testInitThrowsOnInvalidChecksumType() {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js",
            "checksum": 12345 // Not a string
        ]
        XCTAssertThrowsError(try AJPResource(dictionary: dict)) { error in
            let nsError = error as NSError
            XCTAssertEqual(nsError.domain, "ResourceError")
            XCTAssertEqual(nsError.code, 403)
        }
    }

    // MARK: - toDictionary Tests

    func testToDictionaryRoundTrip() throws {
        let original: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js",
            "checksum": "abc123"
        ]
        let resource = try AJPResource(dictionary: original)
        let serialized = resource.toDictionary()

        XCTAssertEqual(serialized["url"] as? String, "https://example.com/index.js")
        XCTAssertEqual(serialized["file_path"] as? String, "main/index.js")
        XCTAssertEqual(serialized["checksum"] as? String, "abc123")
    }

    func testToDictionaryOmitsChecksumWhenNil() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js"
        ]
        let resource = try AJPResource(dictionary: dict)
        let serialized = resource.toDictionary()

        XCTAssertNil(serialized["checksum"])
    }

    // MARK: - NSSecureCoding Tests

    func testSecureCodingRoundTrip() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js",
            "checksum": "abc123"
        ]
        let resource = try AJPResource(dictionary: dict)

        let data = try NSKeyedArchiver.archivedData(withRootObject: resource, requiringSecureCoding: true)
        let decoded = try NSKeyedUnarchiver.unarchivedObject(ofClass: AJPResource.self, from: data)

        XCTAssertEqual(decoded?.url.absoluteString, resource.url.absoluteString)
        XCTAssertEqual(decoded?.filePath, resource.filePath)
        XCTAssertEqual(decoded?.checksum, resource.checksum)
    }

    func testSupportsSecureCoding() {
        XCTAssertTrue(AJPResource.supportsSecureCoding)
    }

    // MARK: - AJPLazyResource Tests

    func testLazyResourceInitWithDictionary() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/chunk.js",
            "file_path": "main/chunk.js",
            "isDownloaded": true
        ]
        let lazy = try AJPLazyResource(dictionary: dict)

        XCTAssertEqual(lazy.url.absoluteString, "https://example.com/chunk.js")
        XCTAssertEqual(lazy.filePath, "main/chunk.js")
        XCTAssertTrue(lazy.isDownloaded)
    }

    func testLazyResourceDefaultsIsDownloadedToFalse() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/chunk.js",
            "file_path": "main/chunk.js"
        ]
        let lazy = try AJPLazyResource(dictionary: dict)
        XCTAssertFalse(lazy.isDownloaded)
    }

    func testLazyResourceInitWithResource() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js",
            "checksum": "abc123"
        ]
        let base = try AJPResource(dictionary: dict)
        let lazy = AJPLazyResource(resource: base)

        XCTAssertEqual(lazy.url.absoluteString, base.url.absoluteString)
        XCTAssertEqual(lazy.filePath, base.filePath)
        XCTAssertEqual(lazy.checksum, base.checksum)
        XCTAssertFalse(lazy.isDownloaded)
    }

    func testLazyResourceToDictionaryIncludesIsDownloaded() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/chunk.js",
            "file_path": "main/chunk.js",
            "isDownloaded": true
        ]
        let lazy = try AJPLazyResource(dictionary: dict)
        let serialized = lazy.toDictionary()

        XCTAssertEqual(serialized["isDownloaded"] as? Bool, true)
        XCTAssertEqual(serialized["url"] as? String, "https://example.com/chunk.js")
    }

    func testLazyResourceSecureCodingRoundTrip() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/chunk.js",
            "file_path": "main/chunk.js",
            "checksum": "def456",
            "isDownloaded": true
        ]
        let lazy = try AJPLazyResource(dictionary: dict)

        let data = try NSKeyedArchiver.archivedData(withRootObject: lazy, requiringSecureCoding: true)
        let decoded = try NSKeyedUnarchiver.unarchivedObject(ofClass: AJPLazyResource.self, from: data)

        XCTAssertEqual(decoded?.url.absoluteString, lazy.url.absoluteString)
        XCTAssertEqual(decoded?.filePath, lazy.filePath)
        XCTAssertEqual(decoded?.checksum, lazy.checksum)
        XCTAssertEqual(decoded?.isDownloaded, true)
    }

    func testLazyResourceSupportsSecureCoding() {
        XCTAssertTrue(AJPLazyResource.supportsSecureCoding)
    }
}

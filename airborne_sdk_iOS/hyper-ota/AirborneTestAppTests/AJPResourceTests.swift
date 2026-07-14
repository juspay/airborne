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

    // MARK: - size Tests

    func testInitParsesSize() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js",
            "size": 1_048_576
        ]
        let resource = try AJPResource(dictionary: dict)
        XCTAssertEqual(resource.size, 1_048_576)
    }

    func testSizeDefaultsToZeroWhenAbsent() throws {
        // A release config from a server that doesn't send `size` must still parse, and the
        // resource simply opts out of progress reporting.
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js"
        ]
        let resource = try AJPResource(dictionary: dict)
        XCTAssertEqual(resource.size, 0)
    }

    func testSizeIgnoresNonNumericValue() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js",
            "size": "not-a-number"
        ]
        let resource = try AJPResource(dictionary: dict)
        XCTAssertEqual(resource.size, 0)
    }

    func testToDictionaryIncludesSizeWhenPositive() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js",
            "size": 4096
        ]
        let resource = try AJPResource(dictionary: dict)
        let serialized = resource.toDictionary()

        XCTAssertEqual((serialized["size"] as? NSNumber)?.int64Value, 4096)
    }

    func testToDictionaryOmitsSizeWhenZero() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js"
        ]
        let resource = try AJPResource(dictionary: dict)
        XCTAssertNil(resource.toDictionary()["size"])
    }

    func testSecureCodingRoundTripPreservesSize() throws {
        let dict: NSDictionary = [
            "url": "https://example.com/index.js",
            "file_path": "main/index.js",
            "size": 987_654_321
        ]
        let resource = try AJPResource(dictionary: dict)

        let data = try NSKeyedArchiver.archivedData(withRootObject: resource, requiringSecureCoding: true)
        let decoded = try NSKeyedUnarchiver.unarchivedObject(ofClass: AJPResource.self, from: data)

        XCTAssertEqual(decoded?.size, 987_654_321)
    }

    func testDecodingArchiveWithoutSizeYieldsZero() throws {
        // Simulates an `app-pkg.dat` written before `size` existed: the archive simply has no
        // "size" key, and decodeInt64(forKey:) returns 0.
        let archiver = NSKeyedArchiver(requiringSecureCoding: true)
        archiver.encode(URL(string: "https://example.com/index.js")! as NSURL, forKey: "url")
        archiver.encode("main/index.js", forKey: "file_path")
        archiver.encode("abc123", forKey: "checksum")
        archiver.finishEncoding()

        let unarchiver = try NSKeyedUnarchiver(forReadingFrom: archiver.encodedData)
        unarchiver.requiresSecureCoding = true
        let decoded = AJPResource(coder: unarchiver)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.filePath, "main/index.js")
        XCTAssertEqual(decoded?.checksum, "abc123")
        XCTAssertEqual(decoded?.size, 0)
    }

    func testLazyResourceRoundTripPreservesSize() throws {
        // AJPLazyResource(resource:) round-trips through toDictionary(), so `size` must
        // survive that hop.
        let dict: NSDictionary = [
            "url": "https://example.com/chunk.js",
            "file_path": "main/chunk.js",
            "size": 2048
        ]
        let base = try AJPResource(dictionary: dict)
        let lazy = AJPLazyResource(resource: base)

        XCTAssertEqual(lazy.size, 2048)
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

//
//  AJPReleaseConfigExtendedTests.swift
//  AirborneTestAppTests
//
//  Covers the extended release config: the `extended=true` query parameter, and the opaque
//  top-level `unresolved_properties` key it adds to the response.
//

import XCTest
@testable import Airborne

final class AJPReleaseConfigExtendedTests: XCTestCase {

    // MARK: - Helpers

    /// The `unresolved_properties` payload, deliberately containing every JSON shape the SDK
    /// must carry without understanding: nested objects, arrays, numbers, bools and null.
    private func makeUnresolvedProperties() -> [String: Any] {
        return [
            "config": [
                "contexts": [
                    ["id": "ctx-1", "condition": ["==": [["var": "os"], "ios"]], "priority": 10],
                    ["id": "ctx-2", "condition": ["in": [["var": "city"], ["blr", "del"]]], "priority": 20]
                ],
                "default_configs": ["package.version": "1", "enabled": true, "ratio": 0.25],
                "dimensions": [
                    "os": ["schema": ["type": "string", "enum": ["ios", "android"]], "position": 1],
                    "city": ["schema": ["type": "string"], "position": 2, "dependency": NSNull()]
                ],
                "overrides": ["ctx-1": ["package.version": "2"]]
            ],
            "config_version": "7488203155491131392",
            "config_last_modified": "2026-07-29T12:05:56.359334Z",
            "experiments": [],
            "experiment_groups": [],
            "experiments_last_modified": "2026-07-29T12:05:56.359334Z"
        ]
    }

    private func makeReleaseConfigJSON(includeUnresolved: Bool) -> Data {
        var json: [String: Any] = [
            "version": "3",
            "config": [
                "version": "cfg-1",
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
            "resources": []
        ]
        if includeUnresolved {
            json["unresolved_properties"] = makeUnresolvedProperties()
        }
        return try! JSONSerialization.data(withJSONObject: json)
    }

    // MARK: - unresolved_properties: decode -> encode round trip

    func testUnresolvedPropertiesRoundTripsAsTopLevelKey() throws {
        let manifest = try AJPApplicationManifest(data: makeReleaseConfigJSON(includeUnresolved: true) as NSData)

        let dict = manifest.toDictionary()

        // Top-level sibling of the existing keys, not a wrapper around them.
        XCTAssertNotNil(dict["config"])
        XCTAssertNotNil(dict["package"])
        XCTAssertNotNil(dict["resources"])
        XCTAssertNotNil(dict["unresolved_properties"])

        // Existing parsing is untouched by the new key.
        XCTAssertEqual((dict["config"] as? NSDictionary)?["version"] as? String, "cfg-1")
        XCTAssertEqual((dict["package"] as? NSDictionary)?["name"] as? String, "my-app")

        // The nested structure survives byte-for-byte in value terms.
        XCTAssertEqual(dict["unresolved_properties"] as? NSDictionary,
                       makeUnresolvedProperties() as NSDictionary)
    }

    func testUnresolvedPropertiesSurvivesFullJSONRoundTrip() throws {
        let original = makeReleaseConfigJSON(includeUnresolved: true)
        let manifest = try AJPApplicationManifest(data: original as NSData)

        // Re-serialise the way AirborneServices.getReleaseConfig() does.
        let reEncoded = try JSONSerialization.data(withJSONObject: manifest.toDictionary())
        let reParsed = try XCTUnwrap(JSONSerialization.jsonObject(with: reEncoded) as? NSDictionary)
        let originalParsed = try XCTUnwrap(JSONSerialization.jsonObject(with: original) as? NSDictionary)

        XCTAssertEqual(reParsed["unresolved_properties"] as? NSDictionary,
                       originalParsed["unresolved_properties"] as? NSDictionary)

        // Deep spot checks, so a failure points at the level that broke.
        let unresolved = try XCTUnwrap(reParsed["unresolved_properties"] as? NSDictionary)
        XCTAssertEqual(unresolved["config_version"] as? String, "7488203155491131392")
        let config = try XCTUnwrap(unresolved["config"] as? NSDictionary)
        let contexts = try XCTUnwrap(config["contexts"] as? NSArray)
        XCTAssertEqual(contexts.count, 2)
        XCTAssertEqual((contexts[0] as? NSDictionary)?["id"] as? String, "ctx-1")
        let dimensions = try XCTUnwrap(config["dimensions"] as? NSDictionary)
        XCTAssertTrue((dimensions["city"] as? NSDictionary)?["dependency"] is NSNull)
    }

    // MARK: - unresolved_properties: absent stays absent

    func testResponseWithoutUnresolvedPropertiesDecodes() throws {
        let manifest = try AJPApplicationManifest(data: makeReleaseConfigJSON(includeUnresolved: false) as NSData)

        XCTAssertNil(manifest.unresolvedProperties)
        XCTAssertEqual(manifest.config.version, "cfg-1")
        XCTAssertEqual(manifest.package.name, "my-app")
    }

    func testAbsentUnresolvedPropertiesIsOmittedNotNull() throws {
        let manifest = try AJPApplicationManifest(data: makeReleaseConfigJSON(includeUnresolved: false) as NSData)

        let dict = manifest.toDictionary()
        XCTAssertFalse(dict.allKeys.contains { ($0 as? String) == "unresolved_properties" })

        // And it must not reappear as an explicit null once serialised.
        let encoded = try JSONSerialization.data(withJSONObject: dict)
        let json = try XCTUnwrap(String(data: encoded, encoding: .utf8))
        XCTAssertFalse(json.contains("unresolved_properties"))
    }

    // MARK: - unresolved_properties: NSSecureCoding (the temp-manifest cache path)

    func testUnresolvedPropertiesSurvivesSecureCodingRoundTrip() throws {
        let manifest = try AJPApplicationManifest(data: makeReleaseConfigJSON(includeUnresolved: true) as NSData)

        let data = try NSKeyedArchiver.archivedData(withRootObject: manifest, requiringSecureCoding: true)
        let decoded = try XCTUnwrap(NSKeyedUnarchiver.unarchivedObject(ofClass: AJPApplicationManifest.self, from: data))

        XCTAssertEqual(decoded.unresolvedProperties, makeUnresolvedProperties() as NSDictionary)
        XCTAssertEqual(decoded.config.version, "cfg-1")
        XCTAssertEqual(decoded.package.name, "my-app")
    }

    func testAbsentUnresolvedPropertiesSurvivesSecureCodingAsNil() throws {
        let manifest = try AJPApplicationManifest(data: makeReleaseConfigJSON(includeUnresolved: false) as NSData)

        let data = try NSKeyedArchiver.archivedData(withRootObject: manifest, requiringSecureCoding: true)
        let decoded = try XCTUnwrap(NSKeyedUnarchiver.unarchivedObject(ofClass: AJPApplicationManifest.self, from: data))

        XCTAssertNil(decoded.unresolvedProperties)
    }

    func testComposedInitWithoutUnresolvedPropertiesStillWorks() throws {
        let config = try AJPApplicationConfig(dictionary: ["version": "1.0"])
        let package = try AJPApplicationPackage(dictionary: ["name": "app", "version": "1.0"])
        let resources = try AJPApplicationResources(resourcesArray: NSArray())

        let manifest = AJPApplicationManifest(package: package, config: config, resources: resources)

        XCTAssertNil(manifest.unresolvedProperties)
        XCTAssertFalse(manifest.toDictionary().allKeys.contains { ($0 as? String) == "unresolved_properties" })
    }

    // MARK: - The cached .dat component

    private static let jsonClasses: [AnyClass] = [NSDictionary.self, NSArray.self, NSString.self, NSNumber.self, NSNull.self]

    /// Drives the real file IO the SDK uses for `app-config.dat` and friends, with the payload
    /// stored as itself rather than wrapped in a model type.
    func testUnresolvedPropertiesRoundTripsThroughFileUtil() throws {
        let fileUtil = AJPFileUtil(workspace: "test_unresolved_workspace", baseBundle: Bundle.main)
        let fileName = AJPApplicationConstants.APP_UNRESOLVED_PROPERTIES_DATA_FILE_NAME
        let folder = AJPApplicationConstants.JUSPAY_MANIFEST_DIR
        defer { try? fileUtil.deleteFile(fileName, inFolder: folder) }

        try fileUtil.writeInstance(makeUnresolvedProperties() as NSDictionary, fileName: fileName, inFolder: folder)

        let readBack = try XCTUnwrap(
            fileUtil.getDecodedInstanceForClasses(Self.jsonClasses, withContentOfFileName: fileName, inFolder: folder) as? NSDictionary
        )

        XCTAssertEqual(readBack, makeUnresolvedProperties() as NSDictionary)

        // Nested shapes specifically, since these are what a narrow allowlist would reject.
        let config = try XCTUnwrap(readBack["config"] as? NSDictionary)
        XCTAssertEqual((config["contexts"] as? NSArray)?.count, 2)
        XCTAssertTrue((config["dimensions"] as? NSDictionary)
            .flatMap { $0["city"] as? NSDictionary }?["dependency"] is NSNull)
        XCTAssertEqual((config["default_configs"] as? NSDictionary)?["ratio"] as? NSNumber, NSNumber(value: 0.25))
    }

    /// Documents why `getDecodedInstanceForClasses` exists: secure decoding validates a
    /// collection's elements too, so the single-class `getDecodedInstanceForClass` cannot read
    /// this payload back. Guards against "simplifying" the read path to the single-class variant.
    func testSingleClassDecodeCannotReadTheNestedPayload() throws {
        let fileUtil = AJPFileUtil(workspace: "test_unresolved_workspace", baseBundle: Bundle.main)
        let fileName = AJPApplicationConstants.APP_UNRESOLVED_PROPERTIES_DATA_FILE_NAME
        let folder = AJPApplicationConstants.JUSPAY_MANIFEST_DIR
        defer { try? fileUtil.deleteFile(fileName, inFolder: folder) }

        try fileUtil.writeInstance(makeUnresolvedProperties() as NSDictionary, fileName: fileName, inFolder: folder)

        XCTAssertThrowsError(
            try fileUtil.getDecodedInstanceForClass(NSDictionary.self, withContentOfFileName: fileName, inFolder: folder)
        )
    }

    func testCachedFileNameFollowsTheDatConvention() {
        XCTAssertEqual(AJPApplicationConstants.APP_UNRESOLVED_PROPERTIES_DATA_FILE_NAME, "app-unresolved-properties.dat")
    }

    // MARK: - extended=true query parameter

    private func queryItems(_ url: URL) -> [URLQueryItem] {
        return URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
    }

    func testExtendedParamIsAddedToURLWithoutQuery() {
        let url = AJPApplicationManager.extendedReleaseConfigURL(from: URL(string: "https://example.com/release/org/app")!)

        XCTAssertEqual(queryItems(url), [URLQueryItem(name: "extended", value: "true")])
        XCTAssertEqual(url.absoluteString, "https://example.com/release/org/app?extended=true")
    }

    func testExtendedParamIsAppendedToAnExistingQueryString() {
        // The HyperSDK-shaped URL, which always ends in ?toss=<n>. Concatenation would produce a
        // malformed "?toss=42?extended=true".
        let configured = "https://beta.assets.juspay.in/hyper/bundles/in.juspay.merchants/app/android/1.0/release-config-v2.json?toss=42"
        let url = AJPApplicationManager.extendedReleaseConfigURL(from: URL(string: configured)!)

        XCTAssertEqual(queryItems(url), [
            URLQueryItem(name: "toss", value: "42"),
            URLQueryItem(name: "extended", value: "true")
        ])
        XCTAssertFalse(url.absoluteString.contains("?toss=42?"))
        XCTAssertEqual(url.absoluteString.components(separatedBy: "?").count, 2)
    }

    func testExistingExtendedParamIsOverwrittenNotDuplicated() {
        let url = AJPApplicationManager.extendedReleaseConfigURL(from: URL(string: "https://example.com/rc?extended=false")!)

        // The flag cannot be turned off from wherever the URL is configured.
        XCTAssertEqual(queryItems(url), [URLQueryItem(name: "extended", value: "true")])
    }

    func testRepeatedExtendedParamsCollapseToASingleTrue() {
        let url = AJPApplicationManager.extendedReleaseConfigURL(from: URL(string: "https://example.com/rc?extended=false&toss=7&extended=maybe")!)

        XCTAssertEqual(queryItems(url), [
            URLQueryItem(name: "toss", value: "7"),
            URLQueryItem(name: "extended", value: "true")
        ])
    }

    func testBuildingIsIdempotent() {
        let once = AJPApplicationManager.extendedReleaseConfigURL(from: URL(string: "https://example.com/rc?toss=1")!)
        let twice = AJPApplicationManager.extendedReleaseConfigURL(from: once)

        XCTAssertEqual(once, twice)
    }

    func testOtherURLComponentsArePreserved() {
        let configured = "https://user@example.com:8443/a/b/release-config.json?toss=42&x=y#frag"
        let url = AJPApplicationManager.extendedReleaseConfigURL(from: URL(string: configured)!)

        XCTAssertEqual(url.scheme, "https")
        XCTAssertEqual(url.host, "example.com")
        XCTAssertEqual(url.port, 8443)
        XCTAssertEqual(url.user, "user")
        XCTAssertEqual(url.path, "/a/b/release-config.json")
        XCTAssertEqual(url.fragment, "frag")
        XCTAssertEqual(queryItems(url), [
            URLQueryItem(name: "toss", value: "42"),
            URLQueryItem(name: "x", value: "y"),
            URLQueryItem(name: "extended", value: "true")
        ])
    }

    func testEncodedQueryValuesAreNotCorrupted() {
        let configured = "https://example.com/rc?dim=a%20b%26c&toss=9"
        let url = AJPApplicationManager.extendedReleaseConfigURL(from: URL(string: configured)!)

        XCTAssertEqual(queryItems(url), [
            URLQueryItem(name: "dim", value: "a b&c"),
            URLQueryItem(name: "toss", value: "9"),
            URLQueryItem(name: "extended", value: "true")
        ])
        // The literal ampersand inside the value must stay percent-encoded on the wire.
        XCTAssertTrue(url.absoluteString.contains("dim=a%20b%26c"))
    }
}

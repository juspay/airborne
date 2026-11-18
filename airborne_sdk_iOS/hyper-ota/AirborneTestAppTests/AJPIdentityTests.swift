//
//  AJPIdentityTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

final class AJPIdentityTests: XCTestCase {

    override func tearDown() {
        AJPIdentity.reset()
        super.tearDown()
    }

    func testDefaultsKeepHistoricalIdentifiers() {
        XCTAssertEqual(AJPIdentity.errorDomain, "in.juspay.Airborne")
        XCTAssertEqual(AJPApplicationConstants.AIRBORNE_MANIFEST_DIR, "JuspayManifests")
        XCTAssertEqual(AJPApplicationConstants.AIRBORNE_PACKAGE_DIR, "JuspayPackages")
        XCTAssertEqual(AJPApplicationConstants.AIRBORNE_RESOURCE_DIR, "JuspayResources")
        XCTAssertEqual(AJPApplicationConstants.APP_VERSION_USER_DEFAULTS_KEY, "in.juspay.airborne.appVersion")
    }

    func testCustomValuesAreApplied() {
        AJPIdentity.identifierPrefix = "com.example"
        AJPIdentity.storageDirectoryPrefix = "Example"

        XCTAssertEqual(AJPIdentity.errorDomain, "com.example.Airborne")
        XCTAssertEqual(AJPIdentity.qualified("NetworkDetector"), "com.example.Airborne.NetworkDetector")
        XCTAssertEqual(AJPApplicationConstants.AIRBORNE_MANIFEST_DIR, "ExampleManifests")
        XCTAssertEqual(AJPApplicationConstants.AIRBORNE_PACKAGE_DIR, "ExamplePackages")
        XCTAssertEqual(AJPApplicationConstants.AIRBORNE_RESOURCE_DIR, "ExampleResources")
        XCTAssertEqual(AJPApplicationConstants.APP_VERSION_USER_DEFAULTS_KEY, "com.example.airborne.appVersion")
    }

    func testInvalidValuesAreIgnored() {
        AJPIdentity.identifierPrefix = "  "
        AJPIdentity.storageDirectoryPrefix = "../Escape"
        AJPIdentity.storageDirectoryPrefix = ""

        XCTAssertEqual(AJPIdentity.identifierPrefix, AJPIdentity.defaultIdentifierPrefix)
        XCTAssertEqual(AJPIdentity.storageDirectoryPrefix, AJPIdentity.defaultStorageDirectoryPrefix)
    }

    func testTrailingDotIsTrimmed() {
        AJPIdentity.identifierPrefix = "com.example."
        XCTAssertEqual(AJPIdentity.errorDomain, "com.example.Airborne")
    }
}

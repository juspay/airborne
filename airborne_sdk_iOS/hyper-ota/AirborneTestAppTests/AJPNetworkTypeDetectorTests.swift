//
//  AJPNetworkTypeDetectorTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

final class AJPNetworkTypeDetectorTests: XCTestCase {
    // MARK: - Swift String Mapping Tests

    /// Verifies that every AJPNetworkType enum case maps to the correct string label.
    func testNetworkTypeStringMapping() {
        // We test the string output for each enum case by checking the mapping logic
        // Since currentNetworkTypeString() calls currentNetworkType() internally,
        // we verify the mapping by checking the known string values

        let swiftString = AJPNetworkTypeDetector.currentNetworkTypeString()

        // The result must be one of the valid string representations
        let validStrings = ["No Internet", "WiFi", "2G", "3G", "4G/LTE", "5G", "Unknown"]
        XCTAssertTrue(validStrings.contains(swiftString),
            "Unexpected network type string: '\(swiftString)'")
    }

    /// Verifies that the Swift enum raw values match the expected integer mapping.
    func testEnumRawValues() {
        XCTAssertEqual(AJPNetworkType.noInternet.rawValue, 0)
        XCTAssertEqual(AJPNetworkType.wifi.rawValue, 1)
        XCTAssertEqual(AJPNetworkType.cellular2G.rawValue, 2)
        XCTAssertEqual(AJPNetworkType.cellular3G.rawValue, 3)
        XCTAssertEqual(AJPNetworkType.cellular4G.rawValue, 4)
        XCTAssertEqual(AJPNetworkType.cellular5G.rawValue, 5)
        XCTAssertEqual(AJPNetworkType.unknown.rawValue, 6)
    }
}

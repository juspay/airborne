//
//  AJPHelpersTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

final class AJPHelpersTests: XCTestCase {
    
    func testSHA256ForData() {
        let inputString = "hello world"
        guard let data = inputString.data(using: .utf8) else {
            XCTFail("Failed to encode string")
            return
        }
        
        let swiftOutput = AJPHelpers.sha256ForData(data)
        // Correctness match
        XCTAssertEqual(swiftOutput, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9")
    }
    
    func testUrlEncodedStringFor() {
        let inputString = "hello world 123 !@#."
        let swiftOutput = AJPHelpers.urlEncodedStringFor(inputString)
        XCTAssertEqual(swiftOutput, "hello+world+123+%21%40%23.")
    }
    
    func testDataFromJSON() {
        let dict: [String: Any] = ["key": "value"]
        
        let swiftData = AJPHelpers.dataFromJSON(dict)
        
        XCTAssertNotNil(swiftData)
        
        // Test nil
        let swiftNilData = AJPHelpers.dataFromJSON(nil)
        XCTAssertEqual(swiftNilData.count, 0)
    }
}


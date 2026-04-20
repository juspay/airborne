//
//  AJPRemoteFileUtilTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

final class AJPRemoteFileUtilTests: XCTestCase {

    var remoteFileUtil: AJPRemoteFileUtil!
    var networkClient: AJPNetworkClient!

    override func setUp() {
        super.setUp()
        networkClient = AJPNetworkClient()
        remoteFileUtil = AJPRemoteFileUtil(networkClient: networkClient)
    }

    override func tearDown() {
        remoteFileUtil = nil
        networkClient = nil
        super.tearDown()
    }

    // MARK: - Exists Checks

    func testCheckWhetherFileExists_Success() {
        let expectation = expectation(description: "File exists")

        // Using a reliable public URL for HTTP 200 checks
        let validURL = URL(string: "https://httpbin.org/get")!

        remoteFileUtil.checkWhetherFileExists(in: validURL) { exists in
            XCTAssertTrue(exists)
            expectation.fulfill()
        }

        waitForExpectations(timeout: 10)
    }

    func testCheckWhetherFileExists_Failure() {
        let expectation = expectation(description: "File does not exist")

        // Using a reliable 404 endpoint
        let invalidURL = URL(string: "https://httpbin.org/status/404")!

        remoteFileUtil.checkWhetherFileExists(in: invalidURL) { exists in
            XCTAssertFalse(exists)
            expectation.fulfill()
        }

        waitForExpectations(timeout: 10)
    }

    func testCheckWhetherFileExistsAsync_Success() async {
        let validURL = URL(string: "https://httpbin.org/get")!
        let exists = await remoteFileUtil.checkWhetherFileExists(in: validURL)
        XCTAssertTrue(exists)
    }

    // MARK: - Download Tests

    func testDownloadFile_Success() {
        let expectation = expectation(description: "Download succeeds")

        let remoteURL = "https://httpbin.org/bytes/1024"
        let localURL = NSTemporaryDirectory().appending("test_download.bin")

        remoteFileUtil.downloadFile(
            from: remoteURL,
            andSaveFileAtUrl: localURL,
            checksum: nil
        ) { status, data, error, response in
            XCTAssertTrue(status)
            XCTAssertNotNil(data)
            XCTAssertNil(error)
            XCTAssertNotNil(response)

            // Verify file actually exists on disk
            let fileManager = FileManager.default
            XCTAssertTrue(fileManager.fileExists(atPath: localURL))
            
            // Cleanup
            try? fileManager.removeItem(atPath: localURL)
            
            expectation.fulfill()
        }

        waitForExpectations(timeout: 15)
    }

    func testDownloadFile_ChecksumMismatch() {
        let expectation = expectation(description: "Checksum mismatch error")

        let remoteURL = "https://httpbin.org/bytes/10"
        let localURL = NSTemporaryDirectory().appending("test_fail.bin")

        // Intentionally invalid checksum
        let invalidChecksum = "abc123invalid"

        remoteFileUtil.downloadFile(
            from: remoteURL,
            andSaveFileAtUrl: localURL,
            checksum: invalidChecksum
        ) { status, data, error, _ in
            XCTAssertFalse(status)
            XCTAssertNil(data)
            XCTAssertNotNil(error)
            XCTAssertTrue(error?.contains("Checksum mismatch") ?? false)
            expectation.fulfill()
        }

        waitForExpectations(timeout: 15)
    }

    // MARK: - Async Download Tests

    func testDownloadFileAsync_Success() async {
        let remoteURL = "https://httpbin.org/bytes/512"
        let localURL = NSTemporaryDirectory().appending("test_async_download.bin")

        let (status, data, error, response) = await remoteFileUtil.downloadFile(
            from: remoteURL,
            andSaveFileAtUrl: localURL,
            checksum: nil
        )

        XCTAssertTrue(status)
        XCTAssertNotNil(data)
        XCTAssertNil(error)
        XCTAssertNotNil(response)

        // Verify file actually exists on disk
        let fileManager = FileManager.default
        XCTAssertTrue(fileManager.fileExists(atPath: localURL))
        
        // Cleanup
        try? fileManager.removeItem(atPath: localURL)
    }

    func testDownloadFileAsync_HTTPErrorStatus() async {
        let remoteURL = "https://httpbin.org/status/404" // Returns 404 Not Found
        let localURL = NSTemporaryDirectory().appending("test_404_download.bin")

        let (status, data, error, response) = await remoteFileUtil.downloadFile(
            from: remoteURL,
            andSaveFileAtUrl: localURL,
            checksum: nil
        )

        XCTAssertFalse(status)
        XCTAssertNil(data)
        XCTAssertNotNil(error)
        XCTAssertTrue(error?.contains("HTTP error 404") ?? false)
        XCTAssertNotNil(response)
        
        let fileManager = FileManager.default
        XCTAssertFalse(fileManager.fileExists(atPath: localURL))
    }

}

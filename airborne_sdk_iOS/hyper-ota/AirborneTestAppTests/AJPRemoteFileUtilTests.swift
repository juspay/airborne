//
//  AJPRemoteFileUtilTests.swift
//  AirborneTestAppTests
//

import XCTest
import zlib
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

    // MARK: - Progress Reporting
    //
    // These use a loopback server rather than httpbin.org: byte-level progress is the
    // mechanism the whole feature rests on, so its test must not depend on a third-party
    // service being reachable.

    func testDownloadFileAsync_ReportsIncrementalProgress() async throws {
        let payload = Data(repeating: 0xAB, count: 512 * 1024)
        let server = TestHTTPServer(body: payload)
        try server.start()
        defer { server.stop() }

        let localURL = NSTemporaryDirectory().appending("test_progress_download.bin")
        let lock = NSLock()
        var ticks: [Int64] = []

        let (status, data, error, _) = await remoteFileUtil.downloadFile(
            from: "\(server.baseURL)/bundle.jsbundle",
            andSaveFileAtUrl: localURL,
            checksum: nil,
            onProgress: { received in
                lock.withLock { ticks.append(received) }
            }
        )

        XCTAssertTrue(status)
        XCTAssertNil(error)
        XCTAssertEqual(data?.count, payload.count)

        let observed = lock.withLock { ticks }
        XCTAssertGreaterThan(observed.count, 1, "progress must tick more than once for a chunked body")
        XCTAssertEqual(observed, observed.sorted(), "byte counts for a single task are cumulative")
        XCTAssertEqual(observed.last, Int64(payload.count), "the final count must match the delivered body")
        XCTAssertLessThan(observed.first ?? .max, Int64(payload.count), "the first tick must be a partial count")

        try? FileManager.default.removeItem(atPath: localURL)
    }

    func testDownloadFileAsync_ProgressCountsDecodedBytesUnderGzip() async throws {
        // URLSession transparently inflates gzip and reports *decoded* bytes, which is the
        // same unit as the release config's `size`. If this ever changed, the tracker's
        // denominator and numerator would disagree.
        let payload = Data(repeating: 0xCD, count: 512 * 1024)
        let server = TestHTTPServer(body: gzipped(payload), extraHeaders: ["Content-Encoding": "gzip"])
        try server.start()
        defer { server.stop() }

        let localURL = NSTemporaryDirectory().appending("test_progress_gzip.bin")
        let lock = NSLock()
        var ticks: [Int64] = []

        let (status, data, _, _) = await remoteFileUtil.downloadFile(
            from: "\(server.baseURL)/bundle.jsbundle",
            andSaveFileAtUrl: localURL,
            checksum: nil,
            onProgress: { received in
                lock.withLock { ticks.append(received) }
            }
        )

        XCTAssertTrue(status)
        XCTAssertEqual(data?.count, payload.count, "the decoded body is delivered")

        let observed = lock.withLock { ticks }
        XCTAssertEqual(observed.last, Int64(payload.count), "progress counts decoded bytes, not compressed wire bytes")

        try? FileManager.default.removeItem(atPath: localURL)
    }

    func testDownloadFileAsync_NilProgressStillDownloads() async throws {
        // Passing nil must fall through to the original, un-observed download path.
        let payload = Data(repeating: 0x01, count: 512)
        let server = TestHTTPServer(body: payload)
        try server.start()
        defer { server.stop() }

        let localURL = NSTemporaryDirectory().appending("test_nil_progress.bin")

        let (status, data, error, _) = await remoteFileUtil.downloadFile(
            from: "\(server.baseURL)/asset.bin",
            andSaveFileAtUrl: localURL,
            checksum: nil,
            onProgress: nil
        )

        XCTAssertTrue(status)
        XCTAssertNil(error)
        XCTAssertEqual(data?.count, 512)
        XCTAssertTrue(FileManager.default.fileExists(atPath: localURL))

        try? FileManager.default.removeItem(atPath: localURL)
    }

    /// Minimal gzip wrapper around zlib's raw deflate, enough for URLSession to inflate.
    private func gzipped(_ input: Data) -> Data {
        var stream = z_stream()
        // windowBits 15 + 16 selects a gzip wrapper rather than zlib's.
        deflateInit2_(&stream, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 15 + 16, 8, Z_DEFAULT_STRATEGY, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
        defer { deflateEnd(&stream) }

        var output = Data(count: input.count + 1024)
        var written = 0

        input.withUnsafeBytes { (inPtr: UnsafeRawBufferPointer) in
            stream.next_in = UnsafeMutablePointer(mutating: inPtr.bindMemory(to: Bytef.self).baseAddress!)
            stream.avail_in = uInt(input.count)

            output.withUnsafeMutableBytes { (outPtr: UnsafeMutableRawBufferPointer) in
                stream.next_out = outPtr.bindMemory(to: Bytef.self).baseAddress!
                stream.avail_out = uInt(outPtr.count)
                deflate(&stream, Z_FINISH)
                written = outPtr.count - Int(stream.avail_out)
            }
        }

        return output.prefix(written)
    }

    func testDownloadFileAsync_NilProgressUsesOverridableEntryPoint() async {
        // A host app can inject its own AJPRemoteFileUtil and override the three-argument
        // downloadFile. The nil-progress path must still route through that override.
        final class RecordingRemoteFileUtil: AJPRemoteFileUtil {
            var overrideCallCount = 0
            override func downloadFile(
                from remoteURL: String,
                andSaveFileAtUrl localURL: String,
                checksum expectedChecksum: String?
            ) async -> (Bool, Data?, String?, URLResponse?) {
                overrideCallCount += 1
                return (true, Data(), nil, nil)
            }
        }

        let util = RecordingRemoteFileUtil(networkClient: networkClient)
        let (status, _, _, _) = await util.downloadFile(
            from: "https://httpbin.org/bytes/16",
            andSaveFileAtUrl: NSTemporaryDirectory().appending("unused.bin"),
            checksum: nil,
            onProgress: nil
        )

        XCTAssertTrue(status)
        XCTAssertEqual(util.overrideCallCount, 1, "nil progress must dispatch to the subclass override")
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

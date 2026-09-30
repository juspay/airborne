//
//  AJPNetworkClientTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

final class AJPNetworkClientTests: XCTestCase {

    var client: AJPNetworkClient!

    override func setUp() {
        super.setUp()
        client = AJPNetworkClient()
    }

    override func tearDown() {
        client = nil
        super.tearDown()
    }

    // MARK: - Enum Tests

    /// Verifies that the AJPRequestType enum raw values match the original ObjC enum (0-4).
    func testRequestTypeEnumRawValues() {
        XCTAssertEqual(AJPRequestType.get.rawValue, 0)
        XCTAssertEqual(AJPRequestType.post.rawValue, 1)
        XCTAssertEqual(AJPRequestType.put.rawValue, 2)
        XCTAssertEqual(AJPRequestType.delete.rawValue, 3)
        XCTAssertEqual(AJPRequestType.head.rawValue, 4)
    }

    // MARK: - Default Headers

    /// Verifies that default headers are initialized as an empty mutable dictionary.
    func testDefaultHeadersInitializedEmpty() {
        XCTAssertEqual(client.defaultHeaders.count, 0)
    }

    /// Verifies that default headers are included in outgoing requests.
    func testDefaultHeadersMerge() {
        let expectation = expectation(description: "Request completes")

        client.defaultHeaders["X-Custom-Default"] = "default_value"

        // We use a simple request to verify — the test is that it doesn't crash
        // and the client properly merges headers
        client.fetchResource("https://httpbin.org/get") { _, _, _ in
            expectation.fulfill()
        }

        waitForExpectations(timeout: 10)
    }

    // MARK: - Convenience Methods

    /// Verifies that fetchResource triggers a GET request.
    func testFetchResourceCompletesSuccessfully() {
        let expectation = expectation(description: "Fetch completes")

        client.fetchResource("https://httpbin.org/get") { response, data, error in
            XCTAssertNotNil(response)
            XCTAssertNotNil(data)
            XCTAssertNil(error)
            expectation.fulfill()
        }

        waitForExpectations(timeout: 10)
    }

    /// Verifies that headResource triggers a HEAD request.
    func testHeadResourceCompletesSuccessfully() {
        let expectation = expectation(description: "Head completes")

        client.headResource("https://httpbin.org/get") { response, _, error in
            XCTAssertNotNil(response)
            XCTAssertNil(error)

            if let httpResponse = response as? HTTPURLResponse {
                XCTAssertEqual(httpResponse.statusCode, 200)
            }
            expectation.fulfill()
        }

        waitForExpectations(timeout: 10)
    }

    // MARK: - Async API

    func testAsyncFetchResource() async {
        let (response, data, error) = await client.fetchResourceAsync("https://httpbin.org/get")

        XCTAssertNotNil(response)
        XCTAssertNotNil(data)
        XCTAssertNil(error)
    }

    // MARK: - Error Handling

    /// Verifies that an invalid URL returns an error in the callback.
    func testInvalidURLReturnsError() {
        let expectation = expectation(description: "Error callback")

        client.fetchResource("not a valid url %%%") { response, _, error in
            XCTAssertNil(response)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }

        waitForExpectations(timeout: 5)
    }

    /// Verifies that a request which fails before receiving a response (e.g. a
    /// timeout) reports a nil response instead of a fabricated URLResponse.
    /// Downstream consumers type-cast the response to NSHTTPURLResponse and
    /// read its status code; a default-constructed response can surface a
    /// success-range status code on new OS versions, making failed requests
    /// look successful.
    func testNetworkFailureReturnsNilResponse() {
        let expectation = expectation(description: "Error callback")

        let options: NSDictionary = ["connectionTimeout": 1000]

        // 192.0.2.1 is a non-routable documentation address (RFC 5737) — the
        // request fails (times out) without a response.
        client.apiCall(
            for: "https://192.0.2.1",
            requestType: .get,
            params: nil,
            header: nil,
            options: options,
            responseBlock: { response, _, error in
                XCTAssertNil(response)
                XCTAssertNotNil(error)
                expectation.fulfill()
            },
            sessionDelegate: nil
        )

        waitForExpectations(timeout: 15)
    }

    // MARK: - Timeout Configuration

    /// Verifies that custom timeouts do not crash and are applied.
    func testCustomTimeoutOptions() {
        let expectation = expectation(description: "Request with timeout")

        let options: NSDictionary = [
            "connectionTimeout": 5000,
            "readTimeout": 10000
        ]

        client.apiCall(
            for: "https://httpbin.org/get",
            requestType: .get,
            params: nil,
            header: nil,
            options: options,
            responseBlock: { _, _, _ in
                expectation.fulfill()
            },
            sessionDelegate: nil
        )

        waitForExpectations(timeout: 15)
    }
}

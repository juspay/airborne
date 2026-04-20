//
//  AJPNetworkClient.swift
//  Airborne
//

import Foundation

/// HTTP request method types supported by the network client.
@objc public enum AJPRequestType: Int {
    case get = 0
    case post
    case put
    case delete
    case head
}

/// A callback block invoked when a network request finishes.
/// - Parameters:
///   - response: The URL response received from the server.
///   - responseData: The raw response data, or nil if the request failed.
///   - error: An error dictionary if something went wrong, or nil on success.
public typealias AJPAPIResponseBlock = @convention(block) (URLResponse, Data?, [String: Any]?) -> Void

/// A networking client responsible for making HTTP requests.
/// Manages shared URL sessions, default headers, and request body construction.
@objc open class AJPNetworkClient: NSObject {

    /// A logger for tracking network events and errors.
    @objc public weak var logger: AJPLoggerDelegate?

    /// Default headers that are merged into every outgoing request.
    @objc public var defaultHeaders: NSMutableDictionary = NSMutableDictionary()

    /// A shared URLSession for requests that don't need a custom delegate or timeout.
    private var sharedSession: URLSession

    // MARK: - Initialization

    public override init() {
        let config = URLSessionConfiguration.default
        self.sharedSession = URLSession(configuration: config)
        super.init()
    }

    // MARK: - Public API (ObjC compatible, callback-based)

    /// Performs an HTTP request with full control over method, parameters, headers, and session options.
    /// - Parameters:
    ///   - url: The URL string for the request.
    ///   - requestType: The HTTP method to use.
    ///   - params: The request body. Can be NSDictionary, NSArray, NSString, or NSData.
    ///   - headers: Additional HTTP headers to include in the request.
    ///   - options: Configuration options like `connectionTimeout` and `readTimeout` (in milliseconds).
    ///   - responseBlock: A callback invoked when the request completes.
    ///   - sessionDelegate: An optional NSURLSessionDelegate for custom behavior like SSL pinning.
    @objc public func apiCall(
        for url: String,
        requestType: AJPRequestType,
        params: Any?,
        header headers: NSDictionary?,
        options: NSDictionary?,
        responseBlock: @escaping AJPAPIResponseBlock,
        sessionDelegate: URLSessionDelegate?
    ) {
        var connectionTimeout: Int = -1
        var readTimeout: Int = -1

        if let options = options {
            if let ct = options["connectionTimeout"] as? NSNumber {
                connectionTimeout = ct.intValue
            }
            if let rt = options["readTimeout"] as? NSNumber {
                readTimeout = rt.intValue
            }
        }

        // Reuse the shared session when no custom delegate or resource timeout is needed.
        // Create a new session only when a sessionDelegate is provided (e.g. SSL pinning)
        // or when a custom readTimeout requires a different session configuration.
        let session: URLSession
        if sessionDelegate != nil || readTimeout != -1 {
            let config = URLSessionConfiguration.default
            if readTimeout != -1 {
                config.timeoutIntervalForResource = Double(readTimeout) / 1000.0
            }
            session = URLSession(configuration: config, delegate: sessionDelegate, delegateQueue: nil)
        } else {
            session = sharedSession
        }

        guard let requestURL = URL(string: url) else {
            let emptyResponse = URLResponse()
            responseBlock(emptyResponse, nil, ["error": "Invalid URL: \(url)"])
            return
        }

        var urlRequest = URLRequest(url: requestURL)
        if connectionTimeout != -1 {
            urlRequest.timeoutInterval = Double(connectionTimeout) / 1000.0
        }

        // Merge default headers with request-specific headers
        var allHeaders: [String: String] = [:]
        for (key, value) in defaultHeaders {
            if let k = key as? String, let v = value as? String {
                allHeaders[k] = v
            }
        }
        if let headers = headers {
            for (key, value) in headers {
                if let k = key as? String, let v = value as? String {
                    allHeaders[k] = v
                }
            }
        }
        for (key, value) in allHeaders {
            urlRequest.setValue(value, forHTTPHeaderField: key)
        }

        // Set HTTP method
        urlRequest.httpMethod = httpMethodString(for: requestType)

        // Build request body
        let postBody = buildBody(params: params, headers: allHeaders, requestType: requestType)

        if requestType != .get || allHeaders["Content-Type"] == "application/x-www-form-urlencoded" {
            urlRequest.httpBody = postBody
        }

        // Execute request
        let task = session.dataTask(with: urlRequest) { [weak self] data, response, error in
            defer { if session !== self?.sharedSession { session.finishTasksAndInvalidate() } }
            let urlResponse = response ?? URLResponse()

            if let error = error {
                self?.logger?.trackEvent(
                    withLevel: "debug",
                    label: "network_call",
                    key: "result",
                    value: ["error": error.localizedDescription],
                    category: "api_call",
                    subcategory: "network"
                )
                responseBlock(urlResponse, data, ["error": error.localizedDescription])
            } else if let data = data {
                responseBlock(urlResponse, data, nil)
            } else {
                self?.logger?.trackEvent(
                    withLevel: "debug",
                    label: "network_call",
                    key: "result",
                    value: ["error": "Empty response received"],
                    category: "api_call",
                    subcategory: "network"
                )
                responseBlock(urlResponse, data, ["error": "Empty response received"])
            }
        }
        task.resume()
    }

    /// Convenience method for performing a GET request.
    /// - Parameters:
    ///   - url: The URL string to fetch.
    ///   - responseBlock: A callback invoked when the request completes.
    @objc public func fetchResource(_ url: String, responseBlock: @escaping AJPAPIResponseBlock) {
        apiCall(for: url, requestType: .get, params: nil, header: nil, options: nil, responseBlock: responseBlock, sessionDelegate: nil)
    }

    /// Convenience method for performing a HEAD request.
    /// - Parameters:
    ///   - url: The URL string to check.
    ///   - responseBlock: A callback invoked when the request completes.
    @objc public func headResource(_ url: String, responseBlock: @escaping AJPAPIResponseBlock) {
        apiCall(for: url, requestType: .head, params: nil, header: nil, options: nil, responseBlock: responseBlock, sessionDelegate: nil)
    }

    // MARK: - Native Swift Async API

    /// Performs an HTTP request using async/await.
    /// - Parameters:
    ///   - url: The URL string for the request.
    ///   - requestType: The HTTP method to use.
    ///   - params: The request body.
    ///   - headers: Additional HTTP headers.
    ///   - options: Configuration options like `connectionTimeout` and `readTimeout`.
    ///   - sessionDelegate: An optional NSURLSessionDelegate for custom behavior.
    /// - Returns: A tuple of (URLResponse, optional Data, optional error dictionary).
    public func apiCallAsync(
        for url: String,
        requestType: AJPRequestType,
        params: Any? = nil,
        headers: NSDictionary? = nil,
        options: NSDictionary? = nil,
        sessionDelegate: URLSessionDelegate? = nil
    ) async -> (URLResponse, Data?, [String: Any]?) {
        return await withCheckedContinuation { continuation in
            apiCall(for: url, requestType: requestType, params: params, header: headers, options: options, responseBlock: { response, data, error in
                continuation.resume(returning: (response, data, error))
            }, sessionDelegate: sessionDelegate)
        }
    }

    /// Async convenience for performing a GET request.
    public func fetchResourceAsync(_ url: String) async -> (URLResponse, Data?, [String: Any]?) {
        return await apiCallAsync(for: url, requestType: .get)
    }

    /// Async convenience for performing a HEAD request.
    public func headResourceAsync(_ url: String) async -> (URLResponse, Data?, [String: Any]?) {
        return await apiCallAsync(for: url, requestType: .head)
    }

    // MARK: - Private Helpers

    /// Converts an `AJPRequestType` enum to the corresponding HTTP method string.
    private func httpMethodString(for type: AJPRequestType) -> String {
        switch type {
        case .get:    return "GET"
        case .post:   return "POST"
        case .put:    return "PUT"
        case .delete: return "DELETE"
        case .head:   return "HEAD"
        }
    }

    /// Builds the HTTP body data based on the parameters and content type.
    /// - Parameters:
    ///   - params: The request body (NSDictionary, NSArray, NSString, or NSData).
    ///   - headers: The merged request headers (used to check Content-Type).
    ///   - requestType: The HTTP method (body is skipped for GET unless form-encoded).
    /// - Returns: The serialized body data.
    private func buildBody(params: Any?, headers: [String: String], requestType: AJPRequestType) -> Data {
        var postBody = Data()

        if let dict = params as? NSDictionary {
            if headers["Content-Type"] == "application/x-www-form-urlencoded" {
                // Build URL-encoded form body
                let encodableDelimiters = CharacterSet(charactersIn: ":#[]@!$&'()*+,;=")
                let allowedCharacters = CharacterSet.urlQueryAllowed.subtracting(encodableDelimiters)
                var formValues: [String] = []

                for (key, rawValue) in dict {
                    guard let keyStr = key as? String else { continue }

                    var valueStr: String
                    if let strValue = rawValue as? String {
                        valueStr = strValue
                    } else {
                        valueStr = "\(rawValue)"
                    }

                    if let encodedKey = keyStr.addingPercentEncoding(withAllowedCharacters: allowedCharacters),
                       let encodedValue = valueStr.addingPercentEncoding(withAllowedCharacters: allowedCharacters) {
                        formValues.append("\(encodedKey)=\(encodedValue)")
                    }
                }

                let formString = formValues.joined(separator: "&")
                if let formData = formString.data(using: .utf8) {
                    postBody.append(formData)
                }
            } else if requestType != .get && requestType != .head {
                postBody.append(AJPHelpers.dataFromJSON(dict))
            }
        } else if let array = params as? NSArray {
            postBody.append(AJPHelpers.dataFromJSON(array))
        }

        if requestType != .get, let stringParams = params as? String,
           let stringData = stringParams.data(using: .utf8) {
            postBody.append(stringData)
        }

        if requestType != .get, let dataParams = params as? Data {
            postBody.append(dataParams)
        }

        return postBody
    }
}

//
//  AJPRemoteFileUtil.swift
//  Airborne
//

import Foundation

/// A callback block invoked when a file download operation completes.
/// - Parameters:
///   - status: Whether the download succeeded.
///   - data: The downloaded data, or nil on failure.
///   - error: An error message string, or nil on success.
///   - response: The URL response from the server, or nil if unavailable.
public typealias AJPDownloadCallback = @convention(block) (Bool, Data?, String?, URLResponse?) -> Void

/// A utility class for downloading remote files with optional checksum verification.
/// Uses `AJPNetworkClient` for HTTP requests and `AJPHelpers` for SHA256 checksums.
@objc open class AJPRemoteFileUtil: NSObject {

    private let networkClient: AJPNetworkClient

    // MARK: - Initialization

    /// Creates a new remote file utility backed by the given network client.
    /// - Parameter networkClient: The network client used for HTTP requests.
    @objc public init(networkClient: AJPNetworkClient) {
        self.networkClient = networkClient
        super.init()
    }

    // MARK: - Public API (ObjC compatible, callback-based)

    /// Checks whether a remote file exists by performing a HEAD request.
    /// - Parameters:
    ///   - fileUrl: The URL to check.
    ///   - completion: A callback indicating whether the file exists (HTTP 200).
    @objc(checkWhetherFileExistsIn:completion:)
    public func checkWhetherFileExists(in fileUrl: URL, completion: @escaping (Bool) -> Void) {
        Task {
            let exists = await self.checkWhetherFileExists(in: fileUrl)
            completion(exists)
        }
    }

    /// Downloads a file from a remote URL and saves it to a local path.
    /// Optionally validates the downloaded data against an expected SHA256 checksum.
    /// - Parameters:
    ///   - remoteURL: The URL string of the remote file.
    ///   - localURL: The local file path where the downloaded file should be saved.
    ///   - expectedChecksum: An optional SHA256 checksum to validate against. Pass nil to skip validation.
    ///   - callback: A callback invoked with the result of the download operation.
    @objc(downloadFileFromURL:andSaveFileAtUrl:checksum:callback:)
    open func downloadFile(
        from remoteURL: String,
        andSaveFileAtUrl localURL: String,
        checksum expectedChecksum: String?,
        callback: @escaping AJPDownloadCallback
    ) {
        Task {
            let (status, data, error, response) = await self.downloadFile(
                from: remoteURL,
                andSaveFileAtUrl: localURL,
                checksum: expectedChecksum
            )
            callback(status, data, error, response)
        }
    }

    /// Checks if a remote file exists, and if so, downloads it with optional checksum verification.
    /// - Parameters:
    ///   - remoteURL: The URL string of the remote file.
    ///   - localURL: The local file path where the downloaded file should be saved.
    ///   - expectedChecksum: An optional SHA256 checksum to validate against.
    ///   - callback: A callback invoked with the result of the download operation.
    @objc(downloadFileWithCheckFromURL:andSaveFileAtUrl:checksum:callback:)
    open func downloadFileWithCheck(
        from remoteURL: String,
        andSaveFileAtUrl localURL: String,
        checksum expectedChecksum: String?,
        callback: @escaping AJPDownloadCallback
    ) {
        Task {
            guard !remoteURL.isEmpty, let fileUrl = URL(string: remoteURL) else {
                callback(false, nil, "Invalid url: \(remoteURL)", nil)
                return
            }

            guard await self.checkWhetherFileExists(in: fileUrl) else {
                callback(false, nil, "File doesn't exist at url: \(remoteURL)", nil)
                return
            }
            
            let (status, data, error, response) = await self.downloadFile(
                from: remoteURL,
                andSaveFileAtUrl: localURL,
                checksum: expectedChecksum
            )
            callback(status, data, error, response)
        }
    }

    // MARK: - Native Swift Async API

    /// Checks whether a remote file exists by performing a HEAD request.
    /// - Parameter fileUrl: The URL to check.
    /// - Returns: `true` if the file exists (HTTP 200), `false` otherwise.
    public func checkWhetherFileExists(in fileUrl: URL) async -> Bool {
        let (response, _, error) = await networkClient.headResourceAsync(fileUrl.absoluteString)
        if let httpResponse = response as? HTTPURLResponse, error == nil, httpResponse.statusCode == 200 {
            return true
        }
        return false
    }

    /// Downloads a file from a remote URL and saves it to a local path.
    /// - Parameters:
    ///   - remoteURL: The URL string of the remote file.
    ///   - localURL: The local file path to save the file to.
    ///   - expectedChecksum: An optional SHA256 checksum to validate against.
    /// - Returns: A tuple of (success, data, error message, response).
    public func downloadFile(
        from remoteURL: String,
        andSaveFileAtUrl localURL: String,
        checksum expectedChecksum: String?
    ) async -> (Bool, Data?, String?, URLResponse?) {
        let (response, responseData, networkError) = await networkClient.fetchResourceAsync(remoteURL)
        
        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            return (false, nil, "HTTP error \(httpResponse.statusCode) while downloading file from \(remoteURL)", response)
        }

        guard let fileData = responseData else {
            let msg = (networkError?["error"].map { "\($0)" })
                    ?? "No data received in the file from url \(remoteURL)"
            return (false, nil, msg, response)
        }

        // Verify checksum if provided
        if let expectedChecksum = expectedChecksum, !expectedChecksum.isEmpty {
            let computedChecksum = AJPHelpers.sha256ForData(fileData)
            if computedChecksum.lowercased() != expectedChecksum.lowercased() {
                return (
                    false,
                    nil,
                    "Checksum mismatch for file \(remoteURL) (expected \(expectedChecksum), got \(computedChecksum))",
                    response
                )
            }
        }

        // Write file to disk atomically
        do {
            try fileData.write(to: URL(fileURLWithPath: localURL), options: .atomic)
            return (true, fileData, nil, response)
        } catch {
            return (
                false,
                nil,
                "Error while writing the local file downloaded from url \(remoteURL) : \(error.localizedDescription)",
                response
            )
        }
    }
}

//
//  AJPApplicationManagerUtilsTests.swift
//  AirborneTestAppTests
//
//  Unit tests for every non-private method in AJPApplicationManagerUtils.
//
//  Groups
//  ------
//  • Pure functions  – jsFileName, getResponseCode, getStatusString,
//                      isDownloadCompleted, sanitizedError, dictionaryFromResources,
//                      getResourcesFrom
//  • File-system     – prepareTempDirectory, cleanupTempDirectory,
//                      getAllFilesInDirectory, deleteFile
//

import XCTest
@testable import Airborne

final class AJPApplicationManagerUtilsTests: XCTestCase {

    private var workspace: String!
    private var fileUtil: AJPFileUtil!
    private var utils: AJPApplicationManagerUtils!

    // MARK: - Setup / Teardown

    override func setUpWithError() throws {
        workspace = "utils_\(UUID().uuidString)"
        fileUtil  = AJPFileUtil(workspace: workspace, baseBundle: Bundle(for: Self.self))
        let tracker      = AJPApplicationTracker(managerId: "test-id", workspace: workspace)
        let remoteUtil   = AJPRemoteFileUtil(networkClient: AJPNetworkClient())
        utils = AJPApplicationManagerUtils(fileUtil: fileUtil, tracker: tracker, remoteFileUtil: remoteUtil)
    }

    override func tearDownWithError() throws {
        let fm      = FileManager.default
        let library = NSSearchPathForDirectoriesInDomains(.libraryDirectory, .userDomainMask, true).first!
        for folder in [AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
                       AJPApplicationConstants.JUSPAY_MANIFEST_DIR,
                       AJPApplicationConstants.JUSPAY_RESOURCE_DIR] {
            let wsPath = ((library as NSString).appendingPathComponent(folder) as NSString)
                .appendingPathComponent(workspace)
            try? fm.removeItem(atPath: wsPath)
        }
        utils    = nil
        fileUtil = nil
    }

    // MARK: - Helpers

    private func makeResource(url: String, filePath: String, checksum: String? = nil) -> AJPResource {
        var dict: [String: Any] = ["url": url, "file_path": filePath]
        if let cs = checksum { dict["checksum"] = cs }
        return try! AJPResource(dictionary: dict as NSDictionary)
    }

    /// Writes `content` to Library/<folder>/<workspace>/<subFolder>/<name>.
    /// Intermediate directories are created automatically by AJPFileUtil.
    @discardableResult
    private func writeFile(_ name: String, subFolder: String,
                           inFolder folder: String, content: String = "x") throws -> String {
        let path = fileUtil.fullPathInStorageForFilePath("\(subFolder)/\(name)", inFolder: folder)
        try content.write(toFile: path, atomically: true, encoding: .utf8)
        return path
    }

    private var tempDirPath: String {
        fileUtil.fullPathInStorageForFilePath(
            AJPApplicationConstants.JUSPAY_TEMP_DIR,
            inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
    }

    // MARK: - jsFileName

    func testJsFileName_jsaExtension_isConvertedToJs() {
        XCTAssertEqual(utils.jsFileName(for: "bundle.jsa"), "bundle.js")
    }

    func testJsFileName_jsaWithPath_convertsExtensionOnly() {
        XCTAssertEqual(utils.jsFileName(for: "chunks/vendor.jsa"), "chunks/vendor.js")
    }

    func testJsFileName_nonJsaExtensions_areUnchanged() {
        XCTAssertEqual(utils.jsFileName(for: "image.png"),  "image.png")
        XCTAssertEqual(utils.jsFileName(for: "script.js"),  "script.js")
        XCTAssertEqual(utils.jsFileName(for: "data.json"),  "data.json")
    }

    func testJsFileName_emptyString_remainsEmpty() {
        XCTAssertEqual(utils.jsFileName(for: ""), "")
    }

    // MARK: - getResponseCode

    func testGetResponseCode_nilResponse_returnsMinusOne() {
        XCTAssertEqual(utils.getResponseCode(from: nil), -1)
    }

    func testGetResponseCode_http200_returns200() {
        let r = HTTPURLResponse(url: URL(string: "https://example.com")!,
                                statusCode: 200, httpVersion: nil, headerFields: nil)
        XCTAssertEqual(utils.getResponseCode(from: r), 200)
    }

    func testGetResponseCode_http404_returns404() {
        let r = HTTPURLResponse(url: URL(string: "https://example.com")!,
                                statusCode: 404, httpVersion: nil, headerFields: nil)
        XCTAssertEqual(utils.getResponseCode(from: r), 404)
    }

    func testGetResponseCode_nonHTTPResponse_returnsMinusOne() {
        let r = URLResponse(url: URL(string: "https://example.com")!,
                            mimeType: nil, expectedContentLength: 0, textEncodingName: nil)
        XCTAssertEqual(utils.getResponseCode(from: r), -1)
    }

    // MARK: - getStatusString

    func testGetStatusString_downloading() {
        XCTAssertEqual(utils.getStatusString(.downloading), "DOWNLOADING")
    }

    func testGetStatusString_completed() {
        XCTAssertEqual(utils.getStatusString(.completed), "COMPLETED")
    }

    func testGetStatusString_failed() {
        XCTAssertEqual(utils.getStatusString(.failed), "FAILED")
    }

    func testGetStatusString_timeout() {
        XCTAssertEqual(utils.getStatusString(.timeout), "TIMEOUT")
    }

    // MARK: - isDownloadCompleted

    func testIsDownloadCompleted_downloading_returnsFalse() {
        XCTAssertFalse(utils.isDownloadCompleted(.downloading))
    }

    func testIsDownloadCompleted_completed_returnsTrue() {
        XCTAssertTrue(utils.isDownloadCompleted(.completed))
    }

    func testIsDownloadCompleted_failed_returnsTrue() {
        XCTAssertTrue(utils.isDownloadCompleted(.failed))
    }

    func testIsDownloadCompleted_timeout_returnsTrue() {
        XCTAssertTrue(utils.isDownloadCompleted(.timeout))
    }

    // MARK: - sanitizedError

    func testSanitizedError_nil_returnsUnknownError() {
        XCTAssertEqual(utils.sanitizedError(nil), "Unknown error")
    }

    func testSanitizedError_nonNilString_returnsInput() {
        XCTAssertEqual(utils.sanitizedError("network failure"), "network failure")
    }

    func testSanitizedError_emptyString_returnsEmptyString() {
        XCTAssertEqual(utils.sanitizedError(""), "")
    }

    // MARK: - dictionaryFromResources

    func testDictionaryFromResources_emptyArray_returnsEmptyDict() {
        XCTAssertEqual(utils.dictionaryFromResources([]).count, 0)
    }

    func testDictionaryFromResources_singleResource_keyedByFilePath() {
        let r = makeResource(url: "https://cdn.example.com/a.js", filePath: "a.js")
        let dict = utils.dictionaryFromResources([r])
        XCTAssertEqual(dict.count, 1)
        XCTAssertEqual((dict["a.js"] as? AJPResource)?.url.absoluteString,
                       "https://cdn.example.com/a.js")
    }

    func testDictionaryFromResources_multipleResources_allKeysPresent() {
        let r1 = makeResource(url: "https://cdn.example.com/a.js", filePath: "a.js")
        let r2 = makeResource(url: "https://cdn.example.com/b.js", filePath: "b.js")
        let dict = utils.dictionaryFromResources([r1, r2])
        XCTAssertEqual(dict.count, 2)
        XCTAssertNotNil(dict["a.js"])
        XCTAssertNotNil(dict["b.js"])
    }

    func testDictionaryFromResources_duplicateFilePath_lastEntryWins() {
        let r1 = makeResource(url: "https://cdn.example.com/v1.js", filePath: "a.js")
        let r2 = makeResource(url: "https://cdn.example.com/v2.js", filePath: "a.js")
        let dict = utils.dictionaryFromResources([r1, r2])
        XCTAssertEqual(dict.count, 1)
        XCTAssertEqual((dict["a.js"] as? AJPResource)?.url.absoluteString,
                       "https://cdn.example.com/v2.js")
    }

    // MARK: - getResourcesFrom

    func testGetResourcesFrom_firstRun_returnsAllNewSplitsRegardlessOfCurrent() {
        let current = [makeResource(url: "https://cdn.example.com/a.js", filePath: "a.js",
                                    checksum: "aaa")]
        let new = [
            makeResource(url: "https://cdn.example.com/a.js", filePath: "a.js", checksum: "aaa"),
            makeResource(url: "https://cdn.example.com/b.js", filePath: "b.js")
        ]
        let result = utils.getResourcesFrom(new, filtering: current, isFirstRunAfterInstallation: true)
        XCTAssertEqual(result.count, 2, "First run must return every new split unconditionally")
    }

    func testGetResourcesFrom_notFirstRun_emptyCurrentSplits_downloadsAll() {
        let new = [makeResource(url: "https://cdn.example.com/a.js", filePath: "a.js")]
        let result = utils.getResourcesFrom(new, filtering: [], isFirstRunAfterInstallation: false)
        XCTAssertEqual(result.count, 1)
    }

    func testGetResourcesFrom_sameURLNoChecksum_alwaysDownloads() {
        let url = "https://cdn.example.com/a.js"
        let current = [makeResource(url: url, filePath: "a.js")]
        let new     = [makeResource(url: url, filePath: "a.js")]
        let result = utils.getResourcesFrom(new, filtering: current, isFirstRunAfterInstallation: false)
        XCTAssertEqual(result.count, 1, "No checksum on either side → always re-download")
    }

    func testGetResourcesFrom_sameURLMatchingChecksums_skips() {
        let url = "https://cdn.example.com/a.js"
        let current = [makeResource(url: url, filePath: "a.js", checksum: "abc")]
        let new     = [makeResource(url: url, filePath: "a.js", checksum: "abc")]
        let result = utils.getResourcesFrom(new, filtering: current, isFirstRunAfterInstallation: false)
        XCTAssertEqual(result.count, 0, "Same URL and matching checksum → skip download")
    }

    func testGetResourcesFrom_sameURLDifferentChecksums_downloads() {
        let url = "https://cdn.example.com/a.js"
        let current = [makeResource(url: url, filePath: "a.js", checksum: "old")]
        let new     = [makeResource(url: url, filePath: "a.js", checksum: "new")]
        let result = utils.getResourcesFrom(new, filtering: current, isFirstRunAfterInstallation: false)
        XCTAssertEqual(result.count, 1)
    }

    func testGetResourcesFrom_differentURL_downloads() {
        let current = [makeResource(url: "https://cdn.example.com/v1.js", filePath: "a.js")]
        let new     = [makeResource(url: "https://cdn.example.com/v2.js", filePath: "a.js")]
        let result = utils.getResourcesFrom(new, filtering: current, isFirstRunAfterInstallation: false)
        XCTAssertEqual(result.count, 1)
    }

    func testGetResourcesFrom_resourceAbsentFromCurrent_downloads() {
        let current = [makeResource(url: "https://cdn.example.com/a.js", filePath: "a.js",
                                    checksum: "aaa")]
        let new = [
            makeResource(url: "https://cdn.example.com/a.js", filePath: "a.js", checksum: "aaa"),
            makeResource(url: "https://cdn.example.com/b.js", filePath: "b.js")
        ]
        let result = utils.getResourcesFrom(new, filtering: current, isFirstRunAfterInstallation: false)
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.filePath, "b.js", "Only the brand-new split should be downloaded")
    }

    func testGetResourcesFrom_mixedUpdates_onlyDownloadsChangedSplits() {
        let base = "https://cdn.example.com/"
        let current = [
            makeResource(url: base + "a.js", filePath: "a.js", checksum: "aaa"),
            makeResource(url: base + "b.js", filePath: "b.js", checksum: "bbb")
        ]
        let new = [
            makeResource(url: base + "a.js", filePath: "a.js", checksum: "aaa"),   // unchanged
            makeResource(url: base + "b.js", filePath: "b.js", checksum: "bbb2")  // checksum changed
        ]
        let result = utils.getResourcesFrom(new, filtering: current, isFirstRunAfterInstallation: false)
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.filePath, "b.js")
    }

    // MARK: - prepareTempDirectory / cleanupTempDirectory

    func testPrepareTempDirectory_createsTempDirectory() {
        utils.prepareTempDirectory()
        var isDir: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: tempDirPath, isDirectory: &isDir)
        XCTAssertTrue(exists && isDir.boolValue, "Temp directory must exist after prepare")
    }

    func testCleanupTempDirectory_removesTempDirectory() {
        utils.prepareTempDirectory()
        utils.cleanupTempDirectory()
        XCTAssertFalse(FileManager.default.fileExists(atPath: tempDirPath),
                       "Temp directory must not exist after cleanup")
    }

    func testCleanupTempDirectory_whenTempAbsent_doesNotCrash() {
        XCTAssertFalse(FileManager.default.fileExists(atPath: tempDirPath))
        XCTAssertNoThrow(utils.cleanupTempDirectory())
    }

    func testPrepareTempDirectory_clearsExistingContents() throws {
        utils.prepareTempDirectory()
        let stale = (tempDirPath as NSString).appendingPathComponent("stale.js")
        try "stale".write(toFile: stale, atomically: true, encoding: .utf8)
        XCTAssertTrue(FileManager.default.fileExists(atPath: stale))

        utils.prepareTempDirectory()

        XCTAssertFalse(FileManager.default.fileExists(atPath: stale),
                       "Second prepare must clear previous temp contents")
        var isDir: ObjCBool = false
        XCTAssertTrue(FileManager.default.fileExists(atPath: tempDirPath, isDirectory: &isDir) && isDir.boolValue,
                      "Fresh empty temp directory must exist after second prepare")
    }

    // MARK: - getAllFilesInDirectory

    func testGetAllFilesInDirectory_nonexistentSubfolder_returnsEmpty() {
        let result = utils.getAllFilesInDirectory(
            AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
            subFolder: "nonexistent_\(UUID().uuidString)",
            includeSubfolders: false)
        XCTAssertTrue(result.isEmpty)
    }

    func testGetAllFilesInDirectory_flatListing_returnsFileNamesOnly() throws {
        try writeFile("a.js", subFolder: "main", inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        try writeFile("b.js", subFolder: "main", inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        let result = utils.getAllFilesInDirectory(
            AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
            subFolder: "main",
            includeSubfolders: false)
        XCTAssertEqual(Set(result), ["a.js", "b.js"])
    }

    func testGetAllFilesInDirectory_flatListing_excludesSubdirectories() throws {
        try writeFile("a.js",        subFolder: "main",     inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        try writeFile("nested.js",   subFolder: "main/sub", inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        let result = utils.getAllFilesInDirectory(
            AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
            subFolder: "main",
            includeSubfolders: false)
        XCTAssertEqual(result.count, 1)
        XCTAssertTrue(result.contains("a.js"))
        XCTAssertFalse(result.contains("sub"), "Directory entries must not appear in flat listing")
    }

    func testGetAllFilesInDirectory_recursive_includesFilesInSubfolders() throws {
        try writeFile("a.js",      subFolder: "main",     inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        try writeFile("nested.js", subFolder: "main/sub", inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        let result = utils.getAllFilesInDirectory(
            AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
            subFolder: "main",
            includeSubfolders: true)
        XCTAssertTrue(result.contains("a.js"),      "Top-level file must be listed")
        XCTAssertTrue(result.contains("sub/nested.js"), "Nested file must be listed with relative path")
    }

    func testGetAllFilesInDirectory_recursive_excludesDirectoryEntries() throws {
        try writeFile("nested.js", subFolder: "main/sub", inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        let result = utils.getAllFilesInDirectory(
            AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
            subFolder: "main",
            includeSubfolders: true)
        XCTAssertFalse(result.contains("sub"), "Subdirectory names must not appear in recursive listing")
    }

    func testGetAllFilesInDirectory_emptyDirectory_returnsEmpty() throws {
        // Writing a file in a sibling folder creates the workspace directory tree
        // but the "empty_main" subfolder itself has no files.
        let emptyDirPath = fileUtil.fullPathInStorageForFilePath(
            "empty_main", inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        try FileManager.default.createDirectory(atPath: emptyDirPath, withIntermediateDirectories: true)

        let result = utils.getAllFilesInDirectory(
            AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
            subFolder: "empty_main",
            includeSubfolders: false)
        XCTAssertTrue(result.isEmpty)
    }

    // MARK: - deleteFile

    func testDeleteFile_existingFile_isRemovedFromDisk() throws {
        let fullPath = try writeFile("delete_me.js", subFolder: "main",
                                    inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        XCTAssertTrue(FileManager.default.fileExists(atPath: fullPath))

        try utils.deleteFile("delete_me.js", subFolder: "main",
                             inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        XCTAssertFalse(FileManager.default.fileExists(atPath: fullPath))
    }

    func testDeleteFile_nonExistentFile_doesNotThrow() {
        XCTAssertNoThrow(
            try utils.deleteFile("ghost_\(UUID().uuidString).js", subFolder: "main",
                                 inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR),
            "Deleting a missing file must not propagate a throw (error is tracked internally)"
        )
    }

    func testDeleteFile_leavesOtherFilesUntouched() throws {
        let keep   = try writeFile("keep.js",   subFolder: "main", inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        try writeFile("remove.js", subFolder: "main", inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        try utils.deleteFile("remove.js", subFolder: "main",
                             inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)

        XCTAssertTrue(FileManager.default.fileExists(atPath: keep),
                      "deleteFile must only remove the targeted file")
    }
}

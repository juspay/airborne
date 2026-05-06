//
//  AJPApplicationManagerParityTests.swift
//  AirborneTestAppTests
//
//  Unit tests for every public method in AJPApplicationManager (Swift).
//
//  Strategy
//  --------
//  • shouldUseLocalAssets = true  → no network calls; all download statuses become
//    .completed synchronously inside the initializer.
//  • seedStorage() writes deterministic package / config / resources data before
//    the manager is created, so initializeDefaults reads known values.
//  • Each test uses a unique workspace UUID to avoid static shared-manager cache
//    collisions across tests.
//

import XCTest
@testable import Airborne

// MARK: - Test helpers

/// Overrides loadFile to always read from internal storage regardless of the
/// withLocalAssets flag. Without this, readPackageFile/readResourceFile (which
/// pass isLocalAssets=true) skip internal storage and only search the bundle,
/// so any file written by writePackageFile would never be found.
private final class StorageReadableFileUtil: AJPFileUtil {
    override func loadFile(_ filePath: String, folder: String, withLocalAssets _: Bool) throws -> String {
        try super.loadFile(filePath, folder: folder, withLocalAssets: false)
    }
}

// MARK: - Mock delegate

private final class MockManagerDelegate: NSObject, AJPApplicationManagerDelegate {

    private let _fileUtil: AJPFileUtil

    init(fileUtil: AJPFileUtil) {
        _fileUtil = fileUtil
    }

    func getReleaseConfigURL() -> String { "https://assets.juspay.in/hyper/bundles/release-config-v2.json" }
    func shouldUseLocalAssets() -> Bool { true }
    func shouldDoForceUpdate()  -> Bool { true }
    func getBaseBundle()        -> Bundle { Bundle(for: MockManagerDelegate.self) }
    func getFileUtil()          -> AJPFileUtil { _fileUtil }
}

// MARK: - Test case

final class AJPApplicationManagerTests: XCTestCase {

    private var workspace:    String!
    private var fileUtil:     AJPFileUtil!
    private var manager:      AJPApplicationManager!

    // MARK: setUp / tearDown

    override func setUpWithError() throws {
        workspace = "mgr_\(UUID().uuidString)"
        fileUtil  = StorageReadableFileUtil(workspace: workspace, baseBundle: Bundle(for: Self.self))

        try seedStorage()

        let delegate = MockManagerDelegate(fileUtil: fileUtil)
        manager = AJPApplicationManager.getSharedInstance(
            withWorkspace: workspace, delegate: delegate, logger: nil)
    }

    override func tearDownWithError() throws {
        let fm      = FileManager.default
        let library = NSSearchPathForDirectoriesInDomains(.libraryDirectory, .userDomainMask, true).first!
        for folder in [AJPApplicationConstants.JUSPAY_MANIFEST_DIR,
                       AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
                       AJPApplicationConstants.JUSPAY_RESOURCE_DIR] {
            let wsPath = ((library as NSString).appendingPathComponent(folder) as NSString)
                .appendingPathComponent(workspace)
            try? fm.removeItem(atPath: wsPath)
        }
        manager  = nil
        fileUtil = nil
    }

    // MARK: - Storage seeding

    private func seedStorage() throws {
        let pkg: NSDictionary = [
            "name":    "parity-app",
            "version": "2.0.0",
            "index":   ["url": "https://cdn.example.com/index.jsa",  "file_path": "index.jsa"],
            "important": [
                ["url": "https://cdn.example.com/vendor.jsa", "file_path": "vendor.jsa"]
            ],
            "lazy": []
        ]
        try fileUtil.writeInstance(
            AJPApplicationPackage(dictionary: pkg),
            fileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME,
            inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)

        let cfg: NSDictionary = [
            "version":                "2.0.0",
            "boot_timeout":           5000,
            "release_config_timeout": 3000
        ]
        try fileUtil.writeInstance(
            AJPApplicationConfig(dictionary: cfg),
            fileName: AJPApplicationConstants.APP_CONFIG_DATA_FILE_NAME,
            inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)

        let res: NSArray = [
            ["url": "https://cdn.example.com/logo.js", "file_path": "logo.js", "checksum": "abc123"]
        ]
        try fileUtil.writeInstance(
            AJPApplicationResources(resourcesArray: res),
            fileName: AJPApplicationConstants.APP_RESOURCES_DATA_FILE_NAME,
            inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
    }

    /// Writes a UTF-8 file to the path `readPackageFile` / `readResourceFile` resolves.
    private func writePackageFile(_ name: String, content: String) throws {
        let filePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(name)
        let fullPath = fileUtil.fullPathInStorageForFilePath(
            filePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        let dir = (fullPath as NSString).deletingLastPathComponent
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try content.write(toFile: fullPath, atomically: true, encoding: .utf8)
    }

    // MARK: - Download status

    func testIsReleaseConfigDownloadCompleted_trueWithLocalAssets() {
        XCTAssertTrue(manager.isReleaseConfigDownloadCompleted())
    }

    func testIsPackageAndResourceDownloadCompleted_trueWithLocalAssets() {
        XCTAssertTrue(manager.isPackageAndResourceDownloadCompleted())
    }

    func testIsImportantPackageDownloadCompleted_trueWithLocalAssets() {
        XCTAssertTrue(manager.isImportantPackageDownloadCompleted())
    }

    func testIsLazyPackageDownloadCompleted_trueWithLocalAssets() {
        XCTAssertTrue(manager.isLazyPackageDownloadCompleted())
    }

    func testIsResourcesDownloadCompleted_trueWithLocalAssets() {
        XCTAssertTrue(manager.isResourcesDownloadCompleted())
    }

    // MARK: - Timeouts

    func testGetReleaseConfigTimeout_returnsSeededValue() {
        XCTAssertEqual(manager.getReleaseConfigTimeout(), NSNumber(value: 3000))
    }

    func testGetPackageTimeout_returnsSeededValue() {
        XCTAssertEqual(manager.getPackageTimeout(), NSNumber(value: 5000))
    }

    // MARK: - getCurrentResult

    func testGetCurrentResult_resultString_isOK() {
        XCTAssertEqual(manager.getCurrentResult().result, "OK")
    }

    func testGetCurrentResult_errorIsNilForOKStatus() {
        XCTAssertNil(manager.getCurrentResult().error)
    }

    func testGetCurrentResult_releaseConfigIsNotNil() {
        XCTAssertNotNil(manager.getCurrentResult().releaseConfig)
    }

    // MARK: - getCurrentApplicationManifest

    func testGetCurrentApplicationManifest_packageVersion() {
        let m = manager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertEqual(m?.package.version, "2.0.0")
    }

    func testGetCurrentApplicationManifest_packageName() {
        let m = manager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertEqual(m?.package.name, "parity-app")
    }

    func testGetCurrentApplicationManifest_configVersion() {
        let m = manager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertEqual(m?.config.version, "2.0.0")
    }

    func testGetCurrentApplicationManifest_configBootTimeout() {
        let m = manager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertEqual(m?.config.bootTimeout, NSNumber(value: 5000))
    }

    func testGetCurrentApplicationManifest_resourceCount() {
        let m = manager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertEqual(m?.resources.resources.count, 1)
    }

    // MARK: - getPathForPackageFile

    func testGetPathForPackageFile_endsWithMainAndFileName() {
        let path = manager.getPathForPackageFile("bundle.js")
        XCTAssertTrue(path.hasSuffix("/main/bundle.js"))
    }

    func testGetPathForPackageFile_differentFileNames_produceDifferentPaths() {
        XCTAssertNotEqual(manager.getPathForPackageFile("a.js"),
                          manager.getPathForPackageFile("b.js"))
    }

    // MARK: - getPathForAssetsInReleaseConfig

    func testGetPathForAssetsInReleaseConfig_emptyString_returnsNil() {
        XCTAssertNil(manager.getPathForAssetsInReleaseConfig(""))
    }

    func testGetPathForAssetsInReleaseConfig_unknownPath_returnsNil() {
        XCTAssertNil(manager.getPathForAssetsInReleaseConfig("not/in/config.js"))
    }

    func testGetPathForAssetsInReleaseConfig_indexSplit_returnsJsPath() {
        let path = manager.getPathForAssetsInReleaseConfig("index.jsa")
        XCTAssertNotNil(path)
        XCTAssertTrue(path?.hasSuffix("index.js") == true, "jsa must be resolved to js")
    }

    func testGetPathForAssetsInReleaseConfig_importantSplit_returnsJsPath() {
        let path = manager.getPathForAssetsInReleaseConfig("vendor.jsa")
        XCTAssertNotNil(path)
        XCTAssertTrue(path?.hasSuffix("vendor.js") == true)
    }

    // MARK: - getDownloadedSplits

    func testGetDownloadedSplits_containsIndexFilePath() {
        XCTAssertTrue(manager.getDownloadedSplits().contains("index.jsa"))
    }

    func testGetDownloadedSplits_containsImportantSplitFilePath() {
        XCTAssertTrue(manager.getDownloadedSplits().contains("vendor.jsa"))
    }

    func testGetDownloadedSplits_doesNotContainResourceNotOnDisk() {
        // "logo.js" is in the seeded resources manifest but its file was never
        // written to disk, so initializeDefaults must not add it.
        XCTAssertFalse(manager.getDownloadedSplits().contains("logo.js"))
    }

    // MARK: - readPackageFile / readResourceFile

    func testReadPackageFile_missingFile_returnsNil() {
        XCTAssertNil(manager.readPackageFile("nonexistent_\(UUID().uuidString).js"))
    }

    func testReadResourceFile_missingFile_returnsNil() {
        XCTAssertNil(manager.readResourceFile("nonexistent_\(UUID().uuidString).js"))
    }

    func testReadPackageFile_existingFile_returnsContent() throws {
        let name = "pkg_\(UUID().uuidString).js"
        try writePackageFile(name, content: "/* package */")
        XCTAssertEqual(manager.readPackageFile(name), "/* package */")
    }

    func testReadResourceFile_existingFile_returnsContent() throws {
        let name = "res_\(UUID().uuidString).js"
        try writePackageFile(name, content: "/* resource */")
        XCTAssertEqual(manager.readResourceFile(name), "/* resource */")
    }

    // MARK: - waitForPackagesAndResources

    func testWaitForPackagesAndResources_resultIsOK() {
        let exp = expectation(description: "completion")
        var result: String?
        manager.waitForPackagesAndResources { r in
            result = r.result
            exp.fulfill()
        }
        waitForExpectations(timeout: 2)
        XCTAssertEqual(result, "OK")
    }

    func testWaitForPackagesAndResources_manifestPackageVersionMatches() {
        let exp = expectation(description: "completion")
        var version: String?
        manager.waitForPackagesAndResources { r in
            version = r.releaseConfig.package.version
            exp.fulfill()
        }
        waitForExpectations(timeout: 2)
        XCTAssertEqual(version, "2.0.0")
    }
}

//
//  AJPApplicationManagerParityTests.swift
//  AirborneTestAppTests
//
//  Verifies that AJPApplicationManagerObjc and AJPApplicationManager (Swift)
//  return identical results for every shared public method.
//
//  Strategy
//  --------
//  • shouldUseLocalAssets = true  → no network calls; all statuses become
//    .completed immediately inside the designated initializer.
//  • Both managers share one AJPFileUtil (same workspace root on disk) so
//    they always read the same pre-seeded package / config / resources files.
//  • Each test uses a unique workspace UUID to avoid hitting the static
//    shared-manager cache across tests.
//

import XCTest
@testable import Airborne

// MARK: - Mock delegate

private final class MockManagerDelegate: NSObject, AJPApplicationManagerDelegate {

    private let _fileUtil: AJPFileUtil

    init(fileUtil: AJPFileUtil) {
        _fileUtil = fileUtil
    }

    // Required
    func getReleaseConfigURL() -> String { "https://assets.juspay.in/hyper/bundles/in.juspay.merchants/geddit/ios/release/release-config-v2.json" }

    // Optional
    func shouldUseLocalAssets() -> Bool { true }
    func shouldDoForceUpdate()  -> Bool { true }
    func getBaseBundle()        -> Bundle { Bundle(for: MockManagerDelegate.self) }
    func getFileUtil()          -> AJPFileUtil { _fileUtil }
}

// MARK: - Test case

final class AJPApplicationManagerParityTests: XCTestCase {

    private var workspace:    String!
    private var fileUtil:     AJPFileUtil!
    private var objcManager:  AJPApplicationManagerObjc!
    private var swiftManager: AJPApplicationManager!

    // MARK: setUp / tearDown

    override func setUpWithError() throws {
        workspace = "parity_\(UUID().uuidString)"
        fileUtil  = AJPFileUtil(workspace: workspace, baseBundle: Bundle(for: Self.self))

        try seedStorage()

        // Each implementation keeps its own static manager cache, so using
        // different workspace keys prevents cross-impl collisions while both
        // delegates share the same fileUtil → identical on-disk paths.
        let delegate = MockManagerDelegate(fileUtil: fileUtil)
        objcManager  = AJPApplicationManagerObjc.getSharedInstance(
            withWorkspace: workspace + "_o", delegate: delegate, logger: nil)
        swiftManager = AJPApplicationManager.getSharedInstance(
            withWorkspace: workspace + "_s", delegate: delegate, logger: nil)
    }

    override func tearDownWithError() throws {
        // Resolve workspace root: fullPath = …/Documents/<workspace>/JuspayManifests/x
        // Two .deletingLastPathComponent() calls land at …/Documents/<workspace>
        let sample = fileUtil.fullPathInStorageForFilePath(
            "x", inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        let root = URL(fileURLWithPath: sample)
            .deletingLastPathComponent()   // …/JuspayManifests
            .deletingLastPathComponent()   // …/<workspace>
            .path
        try? FileManager.default.removeItem(atPath: root)
        objcManager  = nil
        swiftManager = nil
        fileUtil     = nil
    }

    // MARK: - Storage seeding

    /// Writes deterministic package / config / resources data into the shared
    /// workspace so both managers read the same state during initializeDefaults.
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

    /// Writes a UTF-8 string to the path where `readPackageFile` / `readResourceFile` will look.
    private func writePackageFile(_ name: String, content: String) throws {
        let filePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(name)
        let fullPath = fileUtil.fullPathInStorageForFilePath(
            filePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        let dir = (fullPath as NSString).deletingLastPathComponent
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try content.write(toFile: fullPath, atomically: true, encoding: .utf8)
    }

    // MARK: - Download-status parity

    func testIsReleaseConfigDownloadCompleted() {
        let objc  = objcManager.isReleaseConfigDownloadCompleted()
        let swift = swiftManager.isReleaseConfigDownloadCompleted()
        XCTAssertEqual(objc, swift, "isReleaseConfigDownloadCompleted must match")
        XCTAssertTrue(swift, "Expected true with local assets")
    }

    func testIsPackageAndResourceDownloadCompleted() {
        let objc  = objcManager.isPackageAndResourceDownloadCompleted()
        let swift = swiftManager.isPackageAndResourceDownloadCompleted()
        XCTAssertEqual(objc, swift, "isPackageAndResourceDownloadCompleted must match")
        XCTAssertTrue(swift, "Expected true with local assets")
    }

    func testIsImportantPackageDownloadCompleted() {
        let objc  = objcManager.isImportantPackageDownloadCompleted()
        let swift = swiftManager.isImportantPackageDownloadCompleted()
        XCTAssertEqual(objc, swift, "isImportantPackageDownloadCompleted must match")
        XCTAssertTrue(swift, "Expected true with local assets")
    }

    func testIsLazyPackageDownloadCompleted() {
        let objc  = objcManager.isLazyPackageDownloadCompleted()
        let swift = swiftManager.isLazyPackageDownloadCompleted()
        XCTAssertEqual(objc, swift, "isLazyPackageDownloadCompleted must match")
        XCTAssertTrue(swift, "Expected true with local assets")
    }

    func testIsResourcesDownloadCompleted() {
        let objc  = objcManager.isResourcesDownloadCompleted()
        let swift = swiftManager.isResourcesDownloadCompleted()
        XCTAssertEqual(objc, swift, "isResourcesDownloadCompleted must match")
        XCTAssertTrue(swift, "Expected true with local assets")
    }

    // MARK: - Timeout parity

    func testGetReleaseConfigTimeout() {
        let objc  = objcManager.getReleaseConfigTimeout()
        let swift = swiftManager.getReleaseConfigTimeout()
        XCTAssertEqual(objc, swift, "getReleaseConfigTimeout must match")
        XCTAssertEqual(swift, NSNumber(value: 3000), "Should equal seeded release_config_timeout")
    }

    func testGetPackageTimeout() {
        let objc  = objcManager.getPackageTimeout()
        let swift = swiftManager.getPackageTimeout()
        XCTAssertEqual(objc, swift, "getPackageTimeout must match")
        XCTAssertEqual(swift, NSNumber(value: 5000), "Should equal seeded boot_timeout")
    }

    // MARK: - getCurrentResult parity

    func testGetCurrentResult_resultString() {
        let objc  = objcManager.getCurrentResult().result
        let swift = swiftManager.getCurrentResult().result
        XCTAssertEqual(objc, swift, "getCurrentResult.result must match")
        XCTAssertEqual(swift, "OK")
    }

    func testGetCurrentResult_errorNilForOKStatus() {
        XCTAssertNil(objcManager.getCurrentResult().error,
                     "ObjC error must be nil when result is OK")
        XCTAssertNil(swiftManager.getCurrentResult().error,
                     "Swift error must be nil when result is OK")
    }

    func testGetCurrentResult_manifestNotNil() {
        XCTAssertNotNil(objcManager.getCurrentResult().releaseConfig)
        XCTAssertNotNil(swiftManager.getCurrentResult().releaseConfig)
    }

    // MARK: - getCurrentApplicationManifest parity

    func testGetCurrentApplicationManifest_packageVersion() {
        let objcM  = objcManager.getCurrentApplicationManifest()
        let swiftM = swiftManager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertNotNil(objcM);  XCTAssertNotNil(swiftM)
        XCTAssertEqual(objcM.package.version, swiftM?.package.version,
                       "Package version must match")
        XCTAssertEqual(swiftM?.package.version, "2.0.0")
    }

    func testGetCurrentApplicationManifest_packageName() {
        let objcM  = objcManager.getCurrentApplicationManifest()
        let swiftM = swiftManager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertEqual(objcM.package.name, swiftM?.package.name, "Package name must match")
        XCTAssertEqual(swiftM?.package.name, "parity-app")
    }

    func testGetCurrentApplicationManifest_configVersion() {
        let objcM  = objcManager.getCurrentApplicationManifest()
        let swiftM = swiftManager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertEqual(objcM.config.version, swiftM?.config.version, "Config version must match")
        XCTAssertEqual(swiftM?.config.version, "2.0.0")
    }

    func testGetCurrentApplicationManifest_configBootTimeout() {
        let objcM  = objcManager.getCurrentApplicationManifest()
        let swiftM = swiftManager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertEqual(objcM.config.bootTimeout, swiftM?.config.bootTimeout,
                       "Config bootTimeout must match")
        XCTAssertEqual(swiftM?.config.bootTimeout, NSNumber(value: 5000))
    }

    func testGetCurrentApplicationManifest_resourceCount() {
        let objcM  = objcManager.getCurrentApplicationManifest()
        let swiftM = swiftManager.getCurrentApplicationManifest() as? AJPApplicationManifest
        XCTAssertEqual(objcM.resources.resources.count,
                       swiftM?.resources.resources.count,
                       "Resource count must match")
        XCTAssertEqual(swiftM?.resources.resources.count, 1)
    }

    // MARK: - Path parity

    func testGetPathForPackageFile_identicalPaths() {
        let fileName = "bundle.js"
        let objcPath  = objcManager.getPathForPackageFile(fileName)
        let swiftPath = swiftManager.getPathForPackageFile(fileName)
        XCTAssertEqual(objcPath, swiftPath, "Storage paths must be identical")
        XCTAssertTrue(swiftPath.hasSuffix("/main/\(fileName)"),
                      "Path must end with main/<fileName>")
    }

    func testGetPathForPackageFile_differentFileNames() {
        // Paths must be different for different file names, consistently across both.
        let pathA_objc  = objcManager.getPathForPackageFile("a.js")
        let pathA_swift = swiftManager.getPathForPackageFile("a.js")
        let pathB_objc  = objcManager.getPathForPackageFile("b.js")
        let pathB_swift = swiftManager.getPathForPackageFile("b.js")

        XCTAssertEqual(pathA_objc,  pathA_swift, "Path for a.js must match")
        XCTAssertEqual(pathB_objc,  pathB_swift, "Path for b.js must match")
        XCTAssertNotEqual(pathA_swift, pathB_swift, "Paths for different files must differ")
    }

    func testGetPathForAssetsInReleaseConfig_nilForEmptyString() {
        XCTAssertNil(objcManager.getPathForAssets(inReleaseConfig: ""),
                     "ObjC: empty path → nil")
        XCTAssertNil(swiftManager.getPathForAssetsInReleaseConfig(""),
                     "Swift: empty path → nil")
    }

    func testGetPathForAssetsInReleaseConfig_nilForUnknownPath() {
        let unknown = "not/in/config.js"
        XCTAssertNil(objcManager.getPathForAssets(inReleaseConfig: unknown),
                     "ObjC: path absent from downloadedSplits → nil")
        XCTAssertNil(swiftManager.getPathForAssetsInReleaseConfig(unknown),
                     "Swift: path absent from downloadedSplits → nil")
    }

    func testGetPathForAssetsInReleaseConfig_indexSplitReturnsIdenticalPath() {
        // "index.jsa" is added to _downloadedSplits inside initializeDefaults.
        let split     = "index.jsa"
        let objcPath  = objcManager.getPathForAssets(inReleaseConfig: split)
        let swiftPath = swiftManager.getPathForAssetsInReleaseConfig(split)
        XCTAssertNotNil(objcPath,  "ObjC: index split should yield a path")
        XCTAssertNotNil(swiftPath, "Swift: index split should yield a path")
        XCTAssertEqual(objcPath, swiftPath, "Resolved paths must be identical")
        // jsa → js conversion also verified
        XCTAssertTrue(swiftPath?.hasSuffix("index.js") == true,
                      "Path should reference the .js form of the split")
    }

    func testGetPathForAssetsInReleaseConfig_importantSplitReturnsIdenticalPath() {
        let split     = "vendor.jsa"
        let objcPath  = objcManager.getPathForAssets(inReleaseConfig: split)
        let swiftPath = swiftManager.getPathForAssetsInReleaseConfig(split)
        XCTAssertNotNil(objcPath)
        XCTAssertNotNil(swiftPath)
        XCTAssertEqual(objcPath, swiftPath, "Resolved paths must be identical")
        XCTAssertTrue(swiftPath?.hasSuffix("vendor.js") == true)
    }

    // MARK: - Downloaded splits parity

    func testGetDownloadedSplits_setsAreEqual() {
        let objcSplits  = objcManager.getDownloadedSplits()
        let swiftSplits = swiftManager.getDownloadedSplits()
        XCTAssertEqual(objcSplits, swiftSplits, "Downloaded-splits sets must be identical")
    }

    func testGetDownloadedSplits_containsIndexFilePath() {
        let key = "index.jsa"
        XCTAssertTrue(objcManager.getDownloadedSplits().contains(key),
                      "ObjC: downloadedSplits must contain the index file path")
        XCTAssertTrue(swiftManager.getDownloadedSplits().contains(key),
                      "Swift: downloadedSplits must contain the index file path")
    }

    func testGetDownloadedSplits_containsImportantSplitFilePath() {
        let key = "vendor.jsa"
        XCTAssertTrue(objcManager.getDownloadedSplits().contains(key),
                      "ObjC: downloadedSplits must contain the important-split file path")
        XCTAssertTrue(swiftManager.getDownloadedSplits().contains(key),
                      "Swift: downloadedSplits must contain the important-split file path")
    }

    func testGetDownloadedSplits_doesNotContainUnseededResource() {
        // "logo.js" is in the seeded resources manifest but its file was never
        // written to disk, so initializeDefaults should NOT add it.
        let key = "logo.js"
        XCTAssertFalse(objcManager.getDownloadedSplits().contains(key),
                       "ObjC: undiscovered resource must not be in downloadedSplits")
        XCTAssertFalse(swiftManager.getDownloadedSplits().contains(key),
                       "Swift: undiscovered resource must not be in downloadedSplits")
    }

    // MARK: - File reading parity

    func testReadPackageFile_nilForMissingFile() {
        let name = "nonexistent_\(UUID().uuidString).js"
        XCTAssertNil(objcManager.readPackageFile(name),
                     "ObjC: missing file must return nil")
        XCTAssertNil(swiftManager.readPackageFile(name),
                     "Swift: missing file must return nil")
    }

    func testReadResourceFile_nilForMissingFile() {
        let name = "nonexistent_\(UUID().uuidString).js"
        XCTAssertNil(objcManager.readResourceFile(name),
                     "ObjC: missing resource file must return nil")
        XCTAssertNil(swiftManager.readResourceFile(name),
                     "Swift: missing resource file must return nil")
    }

    func testReadPackageFile_identicalResultForBothManagers() throws {
        // Write a file to the exact path readPackageFile will resolve.
        let fileName = "parity_pkg_\(UUID().uuidString).js"
        try writePackageFile(fileName, content: "/* package parity */")

        let objcResult  = objcManager.readPackageFile(fileName)
        let swiftResult = swiftManager.readPackageFile(fileName)
        XCTAssertEqual(objcResult, swiftResult,
                       "readPackageFile must return the same result for both managers")
    }

    func testReadResourceFile_identicalResultForBothManagers() throws {
        // readResourceFile also reads from JUSPAY_MAIN_DIR inside JUSPAY_PACKAGE_DIR.
        let fileName = "parity_res_\(UUID().uuidString).js"
        try writePackageFile(fileName, content: "/* resource parity */")

        let objcResult  = objcManager.readResourceFile(fileName)
        let swiftResult = swiftManager.readResourceFile(fileName)
        XCTAssertEqual(objcResult, swiftResult,
                       "readResourceFile must return the same result for both managers")
    }

    // MARK: - waitForPackagesAndResources parity

    func testWaitForPackagesAndResources_completesWithSameResult() {
        // With local assets all statuses are already completed, so both
        // completion blocks must fire synchronously (before the 2-second timeout).
        let objcExpect  = expectation(description: "ObjC completion")
        let swiftExpect = expectation(description: "Swift completion")

        var objcResult:  String?
        var swiftResult: String?

        objcManager.waitForPackagesAndResources { result in
            objcResult = result.result
            objcExpect.fulfill()
        }
        swiftManager.waitForPackagesAndResources { result in
            swiftResult = result.result
            swiftExpect.fulfill()
        }

        waitForExpectations(timeout: 2)

        XCTAssertEqual(objcResult, swiftResult,
                       "Both completion handlers must receive the same result string")
        XCTAssertEqual(swiftResult, "OK")
    }

    func testWaitForPackagesAndResources_manifestVersionMatch() {
        let objcExpect  = expectation(description: "ObjC manifest")
        let swiftExpect = expectation(description: "Swift manifest")

        var objcVersion:  String?
        var swiftVersion: String?

        objcManager.waitForPackagesAndResources { result in
            objcVersion = result.releaseConfig.package.version
            objcExpect.fulfill()
        }
        swiftManager.waitForPackagesAndResources { result in
            swiftVersion = result.releaseConfig.package.version
            swiftExpect.fulfill()
        }

        waitForExpectations(timeout: 2)

        XCTAssertEqual(objcVersion, swiftVersion,
                       "Package version in completion result must match")
        XCTAssertEqual(swiftVersion, "2.0.0")
    }
}

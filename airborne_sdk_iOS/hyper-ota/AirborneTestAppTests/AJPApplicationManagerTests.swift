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

private class MockManagerDelegate: NSObject, AJPApplicationManagerDelegate {

    private let _fileUtil: AJPFileUtil
    private let guardEnabled: Bool
    private let baseBundle: Bundle
    private let localAssets: Bool
    private let releaseConfigURL: String

    init(fileUtil: AJPFileUtil, guardEnabled: Bool = false, baseBundle: Bundle? = nil,
         localAssets: Bool = true,
         releaseConfigURL: String = "https://assets.juspay.in/hyper/bundles/release-config-v2.json") {
        _fileUtil = fileUtil
        self.guardEnabled = guardEnabled
        self.baseBundle = baseBundle ?? Bundle(for: MockManagerDelegate.self)
        self.localAssets = localAssets
        self.releaseConfigURL = releaseConfigURL
    }

    func bootGuardEnabled() -> Bool { guardEnabled }

    func getReleaseConfigURL() -> String { releaseConfigURL }
    func shouldUseLocalAssets() -> Bool { localAssets }
    func shouldDoForceUpdate()  -> Bool { true }
    func getBaseBundle()        -> Bundle { baseBundle }
    func getFileUtil()          -> AJPFileUtil { _fileUtil }
}

/// A `MockManagerDelegate` whose manager downloads package files through `remoteFileUtil`.
private final class StubDownloadsManagerDelegate: MockManagerDelegate {
    private let remoteFileUtil: AJPRemoteFileUtil

    init(fileUtil: AJPFileUtil, remoteFileUtil: AJPRemoteFileUtil, guardEnabled: Bool,
         localAssets: Bool, releaseConfigURL: String) {
        self.remoteFileUtil = remoteFileUtil
        super.init(fileUtil: fileUtil, guardEnabled: guardEnabled, localAssets: localAssets,
                   releaseConfigURL: releaseConfigURL)
    }

    func getRemoteFileUtil() -> AJPRemoteFileUtil { remoteFileUtil }
}

/// Serves package file downloads in-process: writes the content stubbed for a URL to the target path.
private final class StubRemoteFileUtil: AJPRemoteFileUtil {
    private let files: [String: Data]

    /// `files`: remote URL to content. Other URLs fail to download.
    init(files: [String: String]) {
        self.files = files.mapValues { Data($0.utf8) }
        super.init(networkClient: AJPNetworkClient())
    }

    override func downloadFile(from remoteURL: String, andSaveFileAtUrl localURL: String,
                               checksum expectedChecksum: String?, requestHeaders: NSDictionary? = nil,
                               options: NSDictionary? = nil) async -> (Bool, Data?, String?, URLResponse?) {
        guard let data = files[remoteURL] else {
            return (false, nil, "no stubbed content for \(remoteURL)", nil)
        }
        do {
            let url = URL(fileURLWithPath: localURL)
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
            return (true, data, nil, nil)
        } catch {
            return (false, nil, error.localizedDescription, nil)
        }
    }
}

/// Collects boot guard events (emitted from the test thread and the snapshot queue).
private final class GuardEventRecorder {
    private let lock = NSLock()
    private var recorded: [String] = []

    var keys: [String] {
        lock.lock()
        defer { lock.unlock() }
        return recorded
    }

    func record(_ key: String, _ value: [String: Any], _ isError: Bool) {
        lock.lock()
        defer { lock.unlock() }
        recorded.append(key)
    }
}

/// Answers the manager's release config fetch (`URLSession.shared`) in-process with `body`,
/// so the fetch completion runs without network. Only requests to `host` are intercepted.
private final class StubReleaseConfigProtocol: URLProtocol {
    static let host = "boot-guard-release-config.invalid"
    static let releaseConfigURL = "https://\(host)/release-config.json"

    private static let lock = NSLock()
    private static var storedBody = Data()
    private static var storedGate: DispatchSemaphore?

    static var body: Data {
        get { lock.lock(); defer { lock.unlock() }; return storedBody }
        set { lock.lock(); defer { lock.unlock() }; storedBody = newValue }
    }

    /// When set, the response waits (at most 10 s) until the gate is signalled.
    static var gate: DispatchSemaphore? {
        get { lock.lock(); defer { lock.unlock() }; return storedGate }
        set { lock.lock(); defer { lock.unlock() }; storedGate = newValue }
    }

    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == host }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        if let gate = Self.gate {
            _ = gate.wait(timeout: .now() + 10)
        }
        guard let url = request.url,
              let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                             headerFields: ["Content-Type": "application/json"]) else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL))
            return
        }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

/// Records the manager's tracker events (key and value).
private final class TrackedEventLogger: NSObject, AJPLoggerDelegate {
    private let lock = NSLock()
    private var events: [(key: String, value: [String: Any])] = []

    func trackEvent(withLevel: String, label: String, key: String, value: Any, category: String, subcategory: String) {
        let copy = (value as? NSDictionary).flatMap { $0.copy() as? [String: Any] } ?? [:]
        lock.lock()
        defer { lock.unlock() }
        events.append((key, copy))
    }

    func values(forKey key: String) -> [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }
        return events.filter { $0.key == key }.map { $0.value }
    }
}

// MARK: - Test case

final class AJPApplicationManagerTests: XCTestCase {

    private var retainedDelegate: MockManagerDelegate!
    private var workspace:    String!
    private var fileUtil:     AJPFileUtil!
    private var manager:      AJPApplicationManager!
    /// APP_VERSION_USER_DEFAULTS_KEY before setUp overwrote it; restored in tearDown.
    private var storedAppVersion: Any?

    // MARK: setUp / tearDown

    override func setUpWithError() throws {
        workspace = "mgr_\(UUID().uuidString)"
        fileUtil  = StorageReadableFileUtil(workspace: workspace, baseBundle: Bundle(for: Self.self))

        // Seed after matching the binary version; otherwise first-launch cleanup
        // intentionally removes our test package before the manager reads it.
        storedAppVersion = UserDefaults.standard.object(forKey: AJPApplicationConstants.APP_VERSION_USER_DEFAULTS_KEY)
        let major = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let minor = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        UserDefaults.standard.set("\(major).\(minor)", forKey: AJPApplicationConstants.APP_VERSION_USER_DEFAULTS_KEY)
        try seedStorage()

        let delegate = MockManagerDelegate(fileUtil: fileUtil)
        retainedDelegate = delegate
        manager = AJPApplicationManager.getSharedInstance(
            withWorkspace: workspace, delegate: delegate, logger: nil)
    }

    override func tearDownWithError() throws {
        // A snapshot still running would write into the guard directory after it is removed.
        manager?.waitForBootGuardSnapshotForTesting()

        let fm      = FileManager.default
        let library = NSSearchPathForDirectoriesInDomains(.libraryDirectory, .userDomainMask, true).first!
        for folder in [AJPApplicationConstants.JUSPAY_MANIFEST_DIR,
                       AJPApplicationConstants.JUSPAY_PACKAGE_DIR,
                       AJPApplicationConstants.JUSPAY_RESOURCE_DIR] {
            let wsPath = ((library as NSString).appendingPathComponent(folder) as NSString)
                .appendingPathComponent(workspace)
            try? fm.removeItem(atPath: wsPath)
        }
        try? fm.removeItem(at: manager.telemetryStateURLForTesting)
        try? fm.removeItem(at: AJPBootGuard.directory(forWorkspace: workspace))
        AJPBootGuard.forgetForTesting(workspace: workspace)
        manager  = nil
        fileUtil = nil

        if let storedAppVersion = storedAppVersion {
            UserDefaults.standard.set(storedAppVersion, forKey: AJPApplicationConstants.APP_VERSION_USER_DEFAULTS_KEY)
        } else {
            UserDefaults.standard.removeObject(forKey: AJPApplicationConstants.APP_VERSION_USER_DEFAULTS_KEY)
        }
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

    // MARK: - Boot guard helpers

    private var guardDirectory: URL { AJPBootGuard.directory(forWorkspace: workspace) }

    private var guardStateURL: URL { guardDirectory.appendingPathComponent(AJPBootGuard.stateFileName) }

    private func readGuardState() throws -> [String: Any] {
        let data = try Data(contentsOf: guardStateURL)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func writeGuardState(_ state: [String: Any]) throws {
        try FileManager.default.createDirectory(at: guardDirectory, withIntermediateDirectories: true)
        try JSONSerialization.data(withJSONObject: state).write(to: guardStateURL, options: .atomic)
    }

    /// Creates a real snapshot directory holding `files` (relative path to content).
    private func seedSnapshot(named name: String, files: [String: String]) throws {
        let directory = guardDirectory.appendingPathComponent(name, isDirectory: true)
        for (relativePath, content) in files {
            let url = directory.appendingPathComponent(relativePath)
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try content.write(to: url, atomically: true, encoding: .utf8)
        }
    }

    private func snapshotDirectoryNames() -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: guardDirectory.path)) ?? []
        return names.filter { $0.hasPrefix(AJPBootGuard.snapshotPrefix) }.sorted()
    }

    private func lastGoodPackage(version: String, index: String) -> [String: Any] {
        return [
            "name": "parity-app",
            "version": version,
            "index": ["url": "https://cdn.example.com/\(index)", "file_path": index],
            "important": [],
            "lazy": []
        ]
    }

    /// Simulates a new process launch: forgets the process-wide guard and creates a new manager
    /// whose delegate has the opt-in flag set before initialisation.
    @discardableResult
    private func relaunch(guardEnabled: Bool, baseBundle: Bundle? = nil, localAssets: Bool = true,
                          releaseConfigURL: String? = nil, remoteFileUtil: AJPRemoteFileUtil? = nil,
                          logger: AJPLoggerDelegate? = nil) -> AJPApplicationManager {
        manager?.waitForBootGuardSnapshotForTesting()
        AJPBootGuard.forgetForTesting(workspace: workspace)
        let delegate: MockManagerDelegate
        if let remoteFileUtil = remoteFileUtil, let releaseConfigURL = releaseConfigURL {
            delegate = StubDownloadsManagerDelegate(fileUtil: fileUtil, remoteFileUtil: remoteFileUtil,
                                                    guardEnabled: guardEnabled, localAssets: localAssets,
                                                    releaseConfigURL: releaseConfigURL)
        } else if let releaseConfigURL = releaseConfigURL {
            delegate = MockManagerDelegate(fileUtil: fileUtil, guardEnabled: guardEnabled, baseBundle: baseBundle,
                                           localAssets: localAssets, releaseConfigURL: releaseConfigURL)
        } else {
            delegate = MockManagerDelegate(fileUtil: fileUtil, guardEnabled: guardEnabled, baseBundle: baseBundle,
                                           localAssets: localAssets)
        }
        retainedDelegate = delegate
        manager = AJPApplicationManager.getSharedInstance(withWorkspace: workspace, delegate: delegate, logger: logger)
        return manager
    }

    private func currentPackageVersion() -> String? {
        (manager.getCurrentApplicationManifest() as? AJPApplicationManifest)?.package.version
    }

    // MARK: - Boot guard

    func testBootGuardDefaultsOff() throws {
        _ = manager.getIndexBundleURL()
        manager.prepareBoot()
        manager.markBootSuccess()
        XCTAssertFalse(FileManager.default.fileExists(atPath: guardDirectory.path))
    }

    func testGuardOffDiscardsExistingStateAndSnapshots() throws {
        try writeGuardState(["blocked": "2.0.0"])
        try seedSnapshot(named: "airborne-good-old", files: ["good.jsa": "good"])

        relaunch(guardEnabled: false)

        XCTAssertFalse(FileManager.default.fileExists(atPath: guardDirectory.path))
        XCTAssertEqual(currentPackageVersion(), "2.0.0")
    }

    func testAcknowledgedBootCountsOnceAndSnapshotsPackage() throws {
        try writePackageFile("index.jsa", content: "rendered")
        try writePackageFile("vendor.jsa", content: "vendor")
        relaunch(guardEnabled: true)

        _ = manager.getIndexBundleURL()
        _ = manager.getIndexBundleURL()
        manager.prepareBoot()
        var state = try readGuardState()
        XCTAssertEqual(state["pending"] as? String, "2.0.0")
        XCTAssertEqual(state["attempts"] as? Int, 1, "only the first bundle-path request in a process counts")

        manager.markBootSuccess()
        state = try readGuardState()
        XCTAssertNil(state["pending"], "pending is cleared on the calling thread")
        XCTAssertEqual(state["attempts"] as? Int, 0)

        manager.waitForBootGuardSnapshotForTesting()
        state = try readGuardState()
        XCTAssertEqual((state["lastGood"] as? NSDictionary)?["version"] as? String, "2.0.0")

        let snapshotName = try XCTUnwrap(state["snapshot"] as? String)
        XCTAssertTrue(snapshotName.hasPrefix(AJPBootGuard.snapshotPrefix))
        XCTAssertFalse(snapshotName.contains("/"), "snapshot is stored relative to the guard directory")
        let snapshot = guardDirectory.appendingPathComponent(snapshotName)
        XCTAssertEqual(try String(contentsOf: snapshot.appendingPathComponent("index.jsa"), encoding: .utf8), "rendered")
        XCTAssertEqual(try String(contentsOf: snapshot.appendingPathComponent("vendor.jsa"), encoding: .utf8), "vendor")
        let values = try snapshot.resourceValues(forKeys: [.isExcludedFromBackupKey])
        XCTAssertEqual(values.isExcludedFromBackup, true)
    }

    func testGuardFlagIsCachedAtInitialization() throws {
        try writePackageFile("index.jsa", content: "rendered")
        relaunch(guardEnabled: true)
        retainedDelegate = nil // the manager holds its delegate weakly

        _ = manager.getIndexBundleURL()

        XCTAssertEqual(try readGuardState()["pending"] as? String, "2.0.0")
    }

    func testNoTrackingWhenIndexFileIsMissing() throws {
        relaunch(guardEnabled: true)

        _ = manager.getIndexBundleURL()
        manager.markBootSuccess()

        let state = try readGuardState()
        XCTAssertNil(state["pending"])
        XCTAssertNil(state["lastGood"])
    }

    func testRollbackAfterTwoUnacknowledgedBootsFallsBackToSnapshot() throws {
        try writePackageFile("index.jsa", content: "bad")
        try seedSnapshot(named: "airborne-good-seed", files: ["good.jsa": "good"])
        try writeGuardState([
            "binary": AJPApplicationManager.currentBinaryIdentity(),
            "lastGood": lastGoodPackage(version: "1.0.0", index: "good.jsa"),
            "snapshot": "airborne-good-seed"
        ])

        // Two launches that load the JS but never acknowledge it.
        for expectedAttempts in 1...AJPBootGuard.maxUnacknowledgedBoots {
            relaunch(guardEnabled: true)
            XCTAssertEqual(currentPackageVersion(), "2.0.0")
            _ = manager.getIndexBundleURL()
            XCTAssertEqual(try readGuardState()["attempts"] as? Int, expectedAttempts)
        }

        // The next launch blocks 2.0.0 and boots the last-good snapshot.
        relaunch(guardEnabled: true)
        var state = try readGuardState()
        XCTAssertEqual(state["blocked"] as? String, "2.0.0")
        XCTAssertNil(state["pending"])
        XCTAssertEqual(currentPackageVersion(), "1.0.0")

        let indexURL = manager.getIndexBundleURL()
        XCTAssertEqual(indexURL.standardizedFileURL.path,
                       guardDirectory.appendingPathComponent("airborne-good-seed/good.jsa").standardizedFileURL.path)
        XCTAssertEqual(try String(contentsOf: indexURL, encoding: .utf8), "good")
        XCTAssertEqual(manager.readPackageFile("good.jsa"), "good")

        // The fallback boot is tracked so a failing fallback is detected too.
        state = try readGuardState()
        XCTAssertEqual(state["pending"] as? String, "1.0.0")
        XCTAssertEqual(state["attempts"] as? Int, 1)

        manager.markBootSuccess()
        state = try readGuardState()
        XCTAssertNil(state["pending"])
        XCTAssertEqual(state["snapshot"] as? String, "airborne-good-seed", "a fallback boot does not re-snapshot")
        XCTAssertEqual(state["blocked"] as? String, "2.0.0")
    }

    func testHealthyLastGoodVersionReadsFromInstalledPackage() throws {
        // lastGood == installed version is the normal case and must not read from the snapshot.
        try writePackageFile("index.jsa", content: "installed")
        try seedSnapshot(named: "airborne-good-seed", files: ["index.jsa": "snapshot"])
        try writeGuardState([
            "binary": AJPApplicationManager.currentBinaryIdentity(),
            "lastGood": lastGoodPackage(version: "2.0.0", index: "index.jsa"),
            "snapshot": "airborne-good-seed"
        ])
        relaunch(guardEnabled: true)

        let indexURL = manager.getIndexBundleURL()

        XCTAssertEqual(try String(contentsOf: indexURL, encoding: .utf8), "installed")
        XCTAssertEqual(manager.readPackageFile("index.jsa"), "installed")
    }

    /// The test bundle ships no release_config.json, so bundled-fallback tests use an app bundle
    /// fixture holding one (package `version`, index `index`) and that index file.
    private func makeAppBundleFixture(version: String, index: String) throws -> Bundle {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("bundle-\(UUID().uuidString)")
            .appendingPathComponent("Fixture.bundle", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

        let releaseConfig: [String: Any] = [
            "version": "1",
            "config": ["version": "1.0.0", "boot_timeout": 1000, "release_config_timeout": 1000, "properties": [:]],
            "package": [
                "name": "parity-app",
                "version": version,
                "properties": [:],
                "index": ["url": "https://cdn.example.com/\(index)", "file_path": index],
                "important": [],
                "lazy": []
            ],
            "resources": []
        ]
        try JSONSerialization.data(withJSONObject: releaseConfig)
            .write(to: url.appendingPathComponent("release_config.json"))
        try "bundled".write(to: url.appendingPathComponent(index), atomically: true, encoding: .utf8)
        return try XCTUnwrap(Bundle(url: url))
    }

    private func bundledPackageVersion(in bundle: Bundle) throws -> String? {
        let url = try XCTUnwrap(bundle.url(forResource: "release_config", withExtension: "json"))
        let json = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any]
        return (json?["package"] as? [String: Any])?["version"] as? String
    }

    func testFailingFallbackDropsLastGoodAndUsesBundledPackage() throws {
        let appBundle = try makeAppBundleFixture(version: "0.9.0", index: "bundled.jsa")
        fileUtil = StorageReadableFileUtil(workspace: workspace, baseBundle: appBundle)
        try writePackageFile("index.jsa", content: "bad")
        try seedSnapshot(named: "airborne-good-seed", files: ["good.jsa": "good"])
        try writeGuardState([
            "binary": AJPApplicationManager.currentBinaryIdentity(),
            "blocked": "2.0.0",
            "pending": "1.0.0",
            "attempts": AJPBootGuard.maxUnacknowledgedBoots,
            "lastGood": lastGoodPackage(version: "1.0.0", index: "good.jsa"),
            "snapshot": "airborne-good-seed"
        ])

        relaunch(guardEnabled: true, baseBundle: appBundle)

        let state = try readGuardState()
        XCTAssertEqual(state["blocked"] as? String, "2.0.0", "the original block is kept")
        XCTAssertNil(state["lastGood"])
        XCTAssertNil(state["snapshot"])
        XCTAssertEqual(snapshotDirectoryNames(), [])
        XCTAssertEqual(currentPackageVersion(), try bundledPackageVersion(in: appBundle))
        XCTAssertEqual(currentPackageVersion(), "0.9.0")

        // The index is read from the app bundle, not from the (blocked) package directory.
        let indexPath = manager.getIndexBundleURL().resolvingSymlinksInPath().path
        let bundlePath = appBundle.bundleURL.resolvingSymlinksInPath().path
        let packageDirectory = URL(fileURLWithPath: fileUtil.fullPathInStorageForFilePath(
            AJPApplicationConstants.JUSPAY_MAIN_DIR, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR))
            .resolvingSymlinksInPath().path
        XCTAssertEqual(indexPath, bundlePath + "/bundled.jsa")
        XCTAssertFalse(indexPath.hasPrefix(packageDirectory + "/"))
        XCTAssertEqual(manager.readPackageFile("bundled.jsa"), "bundled")

        // A bundled boot is never tracked, so this cannot loop.
        XCTAssertNil(try readGuardState()["pending"])
    }

    func testStagedBlockedPackageIsRefusedAndBlockStays() throws {
        try writePackageFile("index.jsa", content: "installed")
        try writeGuardState([
            "binary": AJPApplicationManager.currentBinaryIdentity(),
            "blocked": "3.0.0"
        ])
        let staged: NSDictionary = [
            "name": "parity-app",
            "version": "3.0.0",
            "index": ["url": "https://cdn.example.com/index3.jsa", "file_path": "index3.jsa"],
            "important": [],
            "lazy": []
        ]
        try fileUtil.writeInstance(
            AJPApplicationPackage(dictionary: staged),
            fileName: AJPApplicationConstants.APP_PACKAGE_DATA_TEMP_FILE_NAME,
            inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)

        relaunch(guardEnabled: true)

        XCTAssertEqual(currentPackageVersion(), "2.0.0")
        XCTAssertEqual(try readGuardState()["blocked"] as? String, "3.0.0")
    }

    // MARK: Manager paths while a snapshot fallback runs

    private func packageDictionary(version: String, index: String, important: [String] = [], lazy: [String] = []) -> NSDictionary {
        let split = { (path: String) -> [String: Any] in ["url": "https://cdn.example.com/\(path)", "file_path": path] }
        return [
            "name": "parity-app",
            "version": version,
            "properties": [:],
            "index": split(index),
            "important": important.map(split),
            "lazy": lazy.map(split)
        ]
    }

    private func readInstalledPackage() throws -> AJPApplicationPackage {
        try XCTUnwrap(fileUtil.getDecodedInstanceForClass(
            AJPApplicationPackage.self,
            withContentOfFileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME,
            inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR) as? AJPApplicationPackage)
    }

    private func installedFileExists(_ name: String) -> Bool {
        let filePath = (AJPApplicationConstants.JUSPAY_MAIN_DIR as NSString).appendingPathComponent(name)
        return FileManager.default.fileExists(atPath: fileUtil.fullPathInStorageForFilePath(
            filePath, inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR))
    }

    /// Installs package 2.0.0 (index.js, vendor.js, lazy lazy.js not downloaded yet) and blocks it,
    /// with last-good 1.0.0 (good.js) in a snapshot. The next launch boots that snapshot.
    private func seedBlockedPackageWithSnapshotFallback() throws {
        try fileUtil.writeInstance(
            AJPApplicationPackage(dictionary: packageDictionary(version: "2.0.0", index: "index.js",
                                                                important: ["vendor.js"], lazy: ["lazy.js"])),
            fileName: AJPApplicationConstants.APP_PACKAGE_DATA_FILE_NAME,
            inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        try writePackageFile("index.js", content: "blocked")
        try writePackageFile("vendor.js", content: "blocked vendor")
        try seedSnapshot(named: "airborne-good-seed", files: ["good.js": "good"])
        try writeGuardState([
            "binary": AJPApplicationManager.currentBinaryIdentity(),
            "blocked": "2.0.0",
            "lastGood": lastGoodPackage(version: "1.0.0", index: "good.js"),
            "snapshot": "airborne-good-seed"
        ])
    }

    private func assertRunsSnapshotFallback(file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(currentPackageVersion(), "1.0.0", file: file, line: line)
        guard case .snapshot(let directory) = manager.bootSourceForTesting else {
            return XCTFail("expected a snapshot boot source, got \(manager.bootSourceForTesting)", file: file, line: line)
        }
        XCTAssertEqual(directory.standardizedFileURL.path,
                       guardDirectory.appendingPathComponent("airborne-good-seed").standardizedFileURL.path,
                       file: file, line: line)
        XCTAssertEqual(manager.readPackageFile("good.js"), "good", file: file, line: line)
    }

    func testFetchedReleaseConfigNamingTheBlockedVersionKeepsTheFallbackRunning() throws {
        try seedBlockedPackageWithSnapshotFallback()
        // The release config still names blocked 2.0.0, with one split the installed copy lacks:
        // if the package were not refused, that split would be downloaded and 2.0.0 reinstalled.
        let releaseConfig: [String: Any] = [
            "version": "1",
            "config": ["version": "2.1.0", "boot_timeout": 5000, "release_config_timeout": 5000, "properties": [:]],
            "package": packageDictionary(version: "2.0.0", index: "index.js", important: ["vendor.js", "vendor2.js"]),
            "resources": []
        ]
        StubReleaseConfigProtocol.body = try JSONSerialization.data(withJSONObject: releaseConfig)
        XCTAssertTrue(URLProtocol.registerClass(StubReleaseConfigProtocol.self))
        addTeardownBlock { URLProtocol.unregisterClass(StubReleaseConfigProtocol.self) }

        let logger = TrackedEventLogger()
        relaunch(guardEnabled: true, localAssets: false,
                 releaseConfigURL: StubReleaseConfigProtocol.releaseConfigURL, logger: logger)
        assertRunsSnapshotFallback()

        // The fetch, its completion and the (skipped) package download all run in-process.
        let deadline = Date().addingTimeInterval(10)
        while !(manager.isReleaseConfigDownloadCompleted() && manager.isPackageAndResourceDownloadCompleted()),
              Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        }
        XCTAssertTrue(manager.isReleaseConfigDownloadCompleted())
        XCTAssertTrue(manager.isPackageAndResourceDownloadCompleted())
        XCTAssertEqual(logger.values(forKey: "release_config_fetch").first?["is_success"] as? Bool, true)

        // Refused at the release config: the package is not even diffed or downloaded.
        let refusals = logger.values(forKey: "blocked-package").compactMap { $0["source"] as? String }
        XCTAssertEqual(refusals.filter { $0 == "release_config" }.count, 1)
        XCTAssertFalse(refusals.contains("download"))
        XCTAssertTrue(logger.values(forKey: "important_package_download_started").isEmpty)
        XCTAssertFalse(installedFileExists("vendor2.js"))

        // The running package and the one installed for the next launch are unchanged; the block stays.
        assertRunsSnapshotFallback()
        XCTAssertEqual(try readInstalledPackage().version, "2.0.0")
        XCTAssertEqual(try readGuardState()["blocked"] as? String, "2.0.0")
        // The config of the refused release config still applies.
        XCTAssertEqual((manager.getCurrentApplicationManifest() as? AJPApplicationManifest)?.config.version, "2.1.0")
    }

    func testServerRollbackToTheLastGoodVersionInstallsItAndLiftsTheBlock() throws {
        try seedBlockedPackageWithSnapshotFallback()
        // The server rolls back to 1.0.0, the version this launch already runs from the snapshot.
        let releaseConfig: [String: Any] = [
            "version": "1",
            "config": ["version": "2.1.0", "boot_timeout": 5000, "release_config_timeout": 5000, "properties": [:]],
            "package": packageDictionary(version: "1.0.0", index: "good.js"),
            "resources": []
        ]
        StubReleaseConfigProtocol.body = try JSONSerialization.data(withJSONObject: releaseConfig)
        // Hold the release config until this launch's JS has booted, so the install happens mid-session.
        let gate = DispatchSemaphore(value: 0)
        StubReleaseConfigProtocol.gate = gate
        XCTAssertTrue(URLProtocol.registerClass(StubReleaseConfigProtocol.self))
        addTeardownBlock {
            StubReleaseConfigProtocol.gate = nil
            URLProtocol.unregisterClass(StubReleaseConfigProtocol.self)
        }
        let downloads = StubRemoteFileUtil(files: ["https://cdn.example.com/good.js": "good from server"])

        let logger = TrackedEventLogger()
        relaunch(guardEnabled: true, localAssets: false, releaseConfigURL: StubReleaseConfigProtocol.releaseConfigURL,
                 remoteFileUtil: downloads, logger: logger)
        _ = manager.getIndexBundleURL() // this launch's JS boots the snapshot
        assertRunsSnapshotFallback()
        gate.signal()

        let deadline = Date().addingTimeInterval(10)
        while !(manager.isReleaseConfigDownloadCompleted() && manager.isPackageAndResourceDownloadCompleted()),
              Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        }
        XCTAssertTrue(manager.isPackageAndResourceDownloadCompleted())

        // 1.0.0 was diffed against the installed (blocked) 2.0.0, downloaded and installed.
        XCTAssertEqual(logger.values(forKey: "important_package_download_started").first?["package_version"] as? String, "1.0.0")
        XCTAssertTrue(logger.values(forKey: "blocked-package").filter { $0["source"] as? String != "installed" }.isEmpty)
        XCTAssertEqual(try readInstalledPackage().version, "1.0.0")
        XCTAssertTrue(installedFileExists("good.js"))
        // Installing a server-delivered version other than the blocked one lifts the block.
        XCTAssertNil(try readGuardState()["blocked"])
        XCTAssertEqual(logger.values(forKey: "boot_guard_unblocked").first?["blockedVersion"] as? String, "2.0.0")

        // This launch keeps reading the snapshot it booted ("good", not the server copy).
        assertRunsSnapshotFallback()

        // The next launch runs the installed 1.0.0 from the package directory.
        relaunch(guardEnabled: true)
        XCTAssertEqual(currentPackageVersion(), "1.0.0")
        XCTAssertEqual(manager.bootSourceForTesting, .installed)
        XCTAssertEqual(manager.readPackageFile("good.js"), "good from server")
    }

    func testLaterManagersServeTheFallbackBootedByThisProcess() throws {
        try seedBlockedPackageWithSnapshotFallback()
        let booting = relaunch(guardEnabled: true)
        _ = booting.getIndexBundleURL() // this launch's JS boots the snapshot
        assertRunsSnapshotFallback()

        // An install lifts the block mid-session.
        let next = try AJPApplicationPackage(dictionary: packageDictionary(
            version: "3.0.0", index: "index.js", important: ["vendor.js"]))
        booting.updatePackage(next, didDownloadImportant: false, startTime: Date().timeIntervalSince1970 * 1000)
        XCTAssertNil(try readGuardState()["blocked"])

        // Its downloads are complete, so the next lookup builds a new manager; JS bridges reach
        // the running package through it.
        manager = AJPApplicationManager.getSharedInstance(withWorkspace: workspace, delegate: retainedDelegate, logger: nil)
        XCTAssertFalse(manager === booting)
        XCTAssertTrue(AJPApplicationManager.existingInstance(withWorkspace: workspace) === manager)

        // It serves the package and files this process booted, not the newly installed 3.0.0.
        assertRunsSnapshotFallback()
        XCTAssertEqual(manager.bootSourceForTesting, booting.bootSourceForTesting)
        XCTAssertEqual(manager.getIndexBundleURL().standardizedFileURL.path,
                       booting.currentIndexBundleURL().standardizedFileURL.path)
        XCTAssertEqual(try readInstalledPackage().version, "3.0.0", "3.0.0 stays installed for the next launch")

        // The next launch runs the installed 3.0.0.
        relaunch(guardEnabled: true)
        XCTAssertEqual(currentPackageVersion(), "3.0.0")
        XCTAssertEqual(manager.bootSourceForTesting, .installed)
    }

    func testInstallsDuringSnapshotFallbackWaitForTheNextLaunch() throws {
        try seedBlockedPackageWithSnapshotFallback()
        relaunch(guardEnabled: true)
        _ = manager.getIndexBundleURL() // this launch's JS boots the snapshot
        assertRunsSnapshotFallback()

        // A lazy split of the displaced (installed) package lands: it is recorded on that package.
        let lazy2 = try AJPLazyResource(dictionary: ["url": "https://cdn.example.com/lazy.js", "file_path": "lazy.js"])
        manager.updateLazyPackageDownloadStatus(lazy2, withStatus: true)
        var installed = try readInstalledPackage()
        XCTAssertEqual(installed.version, "2.0.0", "package.json still names the displaced package")
        XCTAssertEqual(installed.lazy.map { $0.isDownloaded }, [true])
        assertRunsSnapshotFallback()

        // A new package is installed: package.json names it for the next launch, but this launch
        // keeps serving the snapshot.
        let next = try AJPApplicationPackage(dictionary: packageDictionary(
            version: "3.0.0", index: "index.js", important: ["vendor.js"], lazy: ["lazy3.js"]))
        manager.updatePackage(next, didDownloadImportant: false, startTime: Date().timeIntervalSince1970 * 1000)
        installed = try readInstalledPackage()
        XCTAssertEqual(installed.version, "3.0.0")
        XCTAssertEqual(installed.lazy.map { $0.isDownloaded }, [false])
        assertRunsSnapshotFallback()

        // Its lazy split lands: recorded on 3.0.0 (now the displaced package), not on the fallback.
        let lazy3 = try AJPLazyResource(dictionary: ["url": "https://cdn.example.com/lazy3.js", "file_path": "lazy3.js"])
        manager.updateLazyPackageDownloadStatus(lazy3, withStatus: true)
        installed = try readInstalledPackage()
        XCTAssertEqual(installed.version, "3.0.0", "package.json still names the displaced package")
        XCTAssertEqual(installed.lazy.map { $0.isDownloaded }, [true])
        assertRunsSnapshotFallback()

        // The next launch runs the installed 3.0.0 from the package directory.
        relaunch(guardEnabled: true)
        XCTAssertEqual(currentPackageVersion(), "3.0.0")
        XCTAssertEqual(manager.bootSourceForTesting, .installed)
    }

    func testLaunchCleanupKeepsTheDisplacedPackageFiles() throws {
        try seedBlockedPackageWithSnapshotFallback()
        try writePackageFile("stale.js", content: "unreferenced")
        // The cleanup runs once per process; let this launch run it (local assets: during init).
        AJPApplicationManager.resetFirstRunAfterAppLaunchForTesting()

        relaunch(guardEnabled: true)

        assertRunsSnapshotFallback()
        XCTAssertFalse(installedFileExists("stale.js"), "the cleanup ran")
        XCTAssertTrue(installedFileExists("index.js"), "the displaced package's files are kept")
        XCTAssertTrue(installedFileExists("vendor.js"), "the displaced package's files are kept")
    }

    func testSnapshotFallbackReadsReleaseConfigResourcesFromThePackageDirectory() throws {
        try seedBlockedPackageWithSnapshotFallback()
        // Resources live in the package directory, never in a snapshot. "vendor.js" is also a file
        // of the blocked package, so it must not be read even though a resource names it.
        let resources: NSArray = [
            ["url": "https://cdn.example.com/logo.js", "file_path": "logo.js", "checksum": "abc123"],
            ["url": "https://cdn.example.com/vendor.js", "file_path": "vendor.js", "checksum": "def456"]
        ]
        try fileUtil.writeInstance(
            AJPApplicationResources(resourcesArray: resources),
            fileName: AJPApplicationConstants.APP_RESOURCES_DATA_FILE_NAME,
            inFolder: AJPApplicationConstants.JUSPAY_MANIFEST_DIR)
        try writePackageFile("logo.js", content: "logo resource")

        relaunch(guardEnabled: true)
        _ = manager.getIndexBundleURL() // this launch's JS boots the snapshot
        assertRunsSnapshotFallback()

        // The resource is served from the package directory (RN getFileContent reads readPackageFile).
        XCTAssertEqual(manager.readPackageFile("logo.js"), "logo resource")
        XCTAssertEqual(manager.readResourceFile("logo.js"), "logo resource")
        let assetPath = try XCTUnwrap(manager.getPathForAssetsInReleaseConfig("logo.js"))
        XCTAssertEqual(try String(contentsOfFile: assetPath, encoding: .utf8), "logo resource")

        // Files of the blocked package, present only in the package directory, are never read.
        XCTAssertTrue(installedFileExists("index.js"))
        XCTAssertTrue(installedFileExists("vendor.js"))
        XCTAssertNil(manager.readPackageFile("index.js"))
        XCTAssertNil(manager.readPackageFile("vendor.js"))
        XCTAssertNil(manager.getPathForAssetsInReleaseConfig("index.js"))
        XCTAssertNil(manager.getPathForAssetsInReleaseConfig("vendor.js"))
        XCTAssertNil(manager.readPackageFile("../logo.js"))
    }

    func testMarkBootSuccessClearsPendingWhenSnapshotFails() throws {
        try writePackageFile("index.jsa", content: "rendered")
        relaunch(guardEnabled: true)
        _ = manager.getIndexBundleURL()
        XCTAssertEqual(try readGuardState()["pending"] as? String, "2.0.0")

        // Remove the booted index so the snapshot copy fails.
        try FileManager.default.removeItem(atPath: manager.getPathForPackageFile("index.jsa"))
        manager.markBootSuccess()
        manager.waitForBootGuardSnapshotForTesting()

        let state = try readGuardState()
        XCTAssertNil(state["pending"])
        XCTAssertEqual(state["attempts"] as? Int, 0)
        XCTAssertNil(state["lastGood"], "the previous last-good package is kept (none here)")
        XCTAssertEqual(snapshotDirectoryNames(), [], "the partial snapshot is deleted")
    }

    func testBinaryIdentityChangeDeletesStateAndSnapshots() throws {
        try writePackageFile("index.jsa", content: "rendered")
        try seedSnapshot(named: "airborne-good-seed", files: ["good.jsa": "good"])
        try writeGuardState([
            "binary": "0.0.0.old-binary",
            "blocked": "2.0.0",
            "lastGood": lastGoodPackage(version: "1.0.0", index: "good.jsa"),
            "snapshot": "airborne-good-seed"
        ])

        relaunch(guardEnabled: true)

        let state = try readGuardState()
        XCTAssertEqual(state["binary"] as? String, AJPApplicationManager.currentBinaryIdentity())
        XCTAssertNil(state["blocked"])
        XCTAssertNil(state["lastGood"])
        XCTAssertEqual(snapshotDirectoryNames(), [])
        XCTAssertEqual(currentPackageVersion(), "2.0.0")
    }

    func testOrphanSnapshotsAreSweptAtLaunch() throws {
        try seedSnapshot(named: "airborne-good-kept", files: ["good.jsa": "good"])
        try seedSnapshot(named: "airborne-good-orphan", files: ["good.jsa": "stale"])
        try writeGuardState([
            "binary": AJPApplicationManager.currentBinaryIdentity(),
            "lastGood": lastGoodPackage(version: "1.0.0", index: "good.jsa"),
            "snapshot": "airborne-good-kept"
        ])

        relaunch(guardEnabled: true)

        XCTAssertEqual(snapshotDirectoryNames(), ["airborne-good-kept"])
    }

    // MARK: - Boot guard state machine (AJPBootGuard directly)

    private func makeGuard(in directory: URL) -> AJPBootGuard {
        AJPBootGuard(directory: directory, enabled: true, binaryIdentity: "test-binary")
    }

    private func temporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("bootguard-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: url) }
        return url
    }

    private func package(version: String, index: String, important: [String] = [], lazy: [String] = []) throws -> AJPApplicationPackage {
        let resource: (String) -> [String: String] = { ["url": "https://cdn.example.com/\($0)", "file_path": $0] }
        let dictionary: NSDictionary = [
            "name": "app",
            "version": version,
            "index": resource(index),
            "important": important.map(resource),
            "lazy": lazy.map(resource)
        ]
        return try AJPApplicationPackage(dictionary: dictionary)
    }

    private func bootAndAcknowledge(_ bootGuard: AJPBootGuard, package: AJPApplicationPackage, source: URL) {
        bootGuard.beginBoot(AJPBootSession(package: package, tracked: true, source: .installed, sourceDirectory: source))
        bootGuard.markBootSuccess()
        bootGuard.waitForSnapshotForTesting()
    }

    private func snapshotNames(in guardDirectory: URL) -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: guardDirectory.path)) ?? []
        return names.filter { $0.hasPrefix(AJPBootGuard.snapshotPrefix) }.sorted()
    }

    /// A source package directory holding `files` (relative path to content).
    private func makeSource(in root: URL, files: [String: String]) throws -> URL {
        let source = root.appendingPathComponent("source")
        for (relativePath, content) in files {
            let url = source.appendingPathComponent(relativePath)
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try content.write(to: url, atomically: true, encoding: .utf8)
        }
        return source
    }

    func testBlockIsNotClearedByAnotherVersionUntilItIsInstalled() throws {
        let root = try temporaryDirectory()
        let guardDirectory = root.appendingPathComponent("guard")
        let source = root.appendingPathComponent("source")
        try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
        try "a".write(to: source.appendingPathComponent("a.js"), atomically: true, encoding: .utf8)

        // Version A boots twice without acknowledgement.
        for _ in 1...AJPBootGuard.maxUnacknowledgedBoots {
            let bootGuard = makeGuard(in: guardDirectory)
            bootGuard.beginBoot(AJPBootSession(package: try package(version: "A", index: "a.js"), tracked: true, source: .installed, sourceDirectory: source))
        }
        var bootGuard = makeGuard(in: guardDirectory)
        XCTAssertTrue(bootGuard.isBlocked("A"))

        // The server names B, but B's download stalls: A stays blocked and is still refused.
        XCTAssertFalse(bootGuard.refusePackage("B", source: "release_config"))
        bootGuard = makeGuard(in: guardDirectory)
        XCTAssertTrue(bootGuard.isBlocked("A"))
        XCTAssertTrue(bootGuard.refusePackage("A", source: "release_config"))

        // Installing the blocked version itself never clears the block.
        bootGuard.packageInstalled("A")
        XCTAssertTrue(bootGuard.isBlocked("A"))

        // Only an installed B clears it.
        bootGuard.packageInstalled("B")
        XCTAssertFalse(makeGuard(in: guardDirectory).isBlocked("A"))
    }

    func testSnapshotDeduplicatesPathsAndReplacesPreviousSnapshot() throws {
        let root = try temporaryDirectory()
        let guardDirectory = root.appendingPathComponent("guard")
        let source = root.appendingPathComponent("source")
        try FileManager.default.createDirectory(at: source.appendingPathComponent("dir"), withIntermediateDirectories: true)
        try "index".write(to: source.appendingPathComponent("index.js"), atomically: true, encoding: .utf8)
        try "nested".write(to: source.appendingPathComponent("dir/chunk.js"), atomically: true, encoding: .utf8)

        let first = try package(version: "1", index: "index.js", important: ["index.js", "./dir/chunk.js", "dir/chunk.js"], lazy: ["missing.js"])
        bootAndAcknowledge(makeGuard(in: guardDirectory), package: first, source: source)
        let firstSnapshots = try FileManager.default.contentsOfDirectory(atPath: guardDirectory.path)
            .filter { $0.hasPrefix(AJPBootGuard.snapshotPrefix) }
        XCTAssertEqual(firstSnapshots.count, 1, "duplicate split paths must not fail the copy")
        let firstSnapshot = guardDirectory.appendingPathComponent(firstSnapshots[0])
        XCTAssertEqual(try String(contentsOf: firstSnapshot.appendingPathComponent("dir/chunk.js"), encoding: .utf8), "nested")

        let second = try package(version: "2", index: "index.js")
        bootAndAcknowledge(makeGuard(in: guardDirectory), package: second, source: source)
        let secondSnapshots = try FileManager.default.contentsOfDirectory(atPath: guardDirectory.path)
            .filter { $0.hasPrefix(AJPBootGuard.snapshotPrefix) }
        XCTAssertEqual(secondSnapshots.count, 1, "the previous snapshot is deleted")
        XCTAssertNotEqual(secondSnapshots[0], firstSnapshots[0])
    }

    func testSnapshotRejectsPathsEscapingItsDirectory() throws {
        let root = try temporaryDirectory()
        let guardDirectory = root.appendingPathComponent("guard")
        let source = root.appendingPathComponent("source")
        try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
        try "index".write(to: source.appendingPathComponent("index.js"), atomically: true, encoding: .utf8)
        try "secret".write(to: root.appendingPathComponent("outside.js"), atomically: true, encoding: .utf8)

        let escaping = try package(version: "1", index: "index.js", important: ["../outside.js"])
        bootAndAcknowledge(makeGuard(in: guardDirectory), package: escaping, source: source)

        let snapshots = try FileManager.default.contentsOfDirectory(atPath: guardDirectory.path)
            .filter { $0.hasPrefix(AJPBootGuard.snapshotPrefix) }
        XCTAssertEqual(snapshots, [])
        XCTAssertNil(makeGuard(in: guardDirectory).lastGoodFallback())
        XCTAssertNil(AJPBootGuard.containedURL("a/../../x.js", in: root))
        XCTAssertNil(AJPBootGuard.containedURL("/etc/hosts", in: root))
    }

    func testContainedURLUsesThePackageFilePathRule() throws {
        let root = try temporaryDirectory()
        // Same rule as readPackageFile: any ".." component is rejected, even one that stays inside.
        for path in ["a/../c.js", "a/./b/../c.js", "..", "../x.js", "/etc/hosts"] {
            XCTAssertFalse(AJPApplicationManager.isPackageRelativePath(path), path)
            XCTAssertNil(AJPBootGuard.containedURL(path, in: root), path)
        }
        // Paths naming the root itself are not files inside it.
        for path in ["", ".", "./"] {
            XCTAssertNil(AJPBootGuard.containedURL(path, in: root), path)
        }
        XCTAssertEqual(AJPBootGuard.containedURL("a/./b//c.js", in: root)?.path,
                       root.standardizedFileURL.appendingPathComponent("a/b/c.js").path)
        XCTAssertEqual(AJPBootGuard.containedURL("index.js", in: root)?.path,
                       root.standardizedFileURL.appendingPathComponent("index.js").path)
        // A file name that merely starts with dots is not a ".." component.
        XCTAssertNotNil(AJPBootGuard.containedURL("..hidden.js", in: root))
    }

    func testStateWriteFailureKeepsPreviousLastGood() throws {
        let root = try temporaryDirectory()
        let guardDirectory = root.appendingPathComponent("guard")
        let source = try makeSource(in: root, files: ["index.js": "index"])

        // Version 1 is acknowledged normally: it becomes last-good with a snapshot.
        bootAndAcknowledge(makeGuard(in: guardDirectory), package: try package(version: "1", index: "index.js"), source: source)
        let previousSnapshots = snapshotNames(in: guardDirectory)
        XCTAssertEqual(previousSnapshots.count, 1)

        // The next launch loads that state, then only the state file becomes unwritable (a
        // directory in its place); snapshot directories can still be created.
        let events = GuardEventRecorder()
        let bootGuard = AJPBootGuard(directory: guardDirectory, enabled: true, binaryIdentity: "test-binary", onEvent: events.record)
        try FileManager.default.removeItem(at: bootGuard.stateURL)
        try FileManager.default.createDirectory(at: bootGuard.stateURL.appendingPathComponent("occupied"), withIntermediateDirectories: true)

        bootAndAcknowledge(bootGuard, package: try package(version: "2", index: "index.js"), source: source)

        XCTAssertTrue(events.keys.contains("boot_guard_persist_failed"))
        XCTAssertFalse(events.keys.contains("boot_guard_snapshot_failed"), "the copy itself succeeded")
        XCTAssertEqual(bootGuard.lastGoodFallback()?.package.version, "1")
        XCTAssertEqual(snapshotNames(in: guardDirectory), previousSnapshots, "the unpersisted snapshot is deleted")
    }

    func testSnapshotSkippedWhenAnotherPackageIsInstalledAfterBoot() throws {
        let root = try temporaryDirectory()
        let guardDirectory = root.appendingPathComponent("guard")
        let source = try makeSource(in: root, files: ["index.js": "index"])
        let events = GuardEventRecorder()
        let bootGuard = AJPBootGuard(directory: guardDirectory, enabled: true, binaryIdentity: "test-binary", onEvent: events.record)

        bootGuard.beginBoot(AJPBootSession(package: try package(version: "1", index: "index.js"), tracked: true, source: .installed, sourceDirectory: source))
        // Version 2 is installed in place while version 1 runs: the package directory is now 2's.
        bootGuard.packageInstallStarted()
        bootGuard.markBootSuccess()
        bootGuard.waitForSnapshotForTesting()

        let state = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: bootGuard.stateURL)) as? [String: Any])
        XCTAssertNil(state["pending"], "the healthy boot is still acknowledged")
        XCTAssertEqual(state["attempts"] as? Int, 0)
        XCTAssertNil(state["lastGood"])
        XCTAssertEqual(snapshotNames(in: guardDirectory), [])
        XCTAssertTrue(events.keys.contains("boot_guard_snapshot_skipped"))
    }

    func testInstallsBeforeTheBootDoNotSkipTheSnapshot() throws {
        let root = try temporaryDirectory()
        let guardDirectory = root.appendingPathComponent("guard")
        let source = try makeSource(in: root, files: ["index.js": "index"])
        let bootGuard = makeGuard(in: guardDirectory)

        // Installed within the boot timeout, before the JS was handed over: this is what boots.
        bootGuard.packageInstallStarted()
        bootAndAcknowledge(bootGuard, package: try package(version: "1", index: "index.js"), source: source)

        XCTAssertEqual(bootGuard.lastGoodFallback()?.package.version, "1")
    }

    func testLaterAcknowledgementAddsLazyFilesMissingFromSnapshot() throws {
        let root = try temporaryDirectory()
        let guardDirectory = root.appendingPathComponent("guard")
        let source = try makeSource(in: root, files: ["index.js": "index"])
        let withLazy = try package(version: "1", index: "index.js", lazy: ["lazy/chunk.js"])

        // First acknowledgement: the lazy split has not been downloaded yet.
        bootAndAcknowledge(makeGuard(in: guardDirectory), package: withLazy, source: source)
        let first = snapshotNames(in: guardDirectory)
        XCTAssertEqual(first.count, 1)
        let firstSnapshot = guardDirectory.appendingPathComponent(first[0])
        XCTAssertFalse(FileManager.default.fileExists(atPath: firstSnapshot.appendingPathComponent("lazy/chunk.js").path))

        // A later healthy launch with nothing new keeps the snapshot.
        bootAndAcknowledge(makeGuard(in: guardDirectory), package: withLazy, source: source)
        XCTAssertEqual(snapshotNames(in: guardDirectory), first)

        // The lazy split arrives; the next healthy launch of the same version re-snapshots.
        try FileManager.default.createDirectory(at: source.appendingPathComponent("lazy"), withIntermediateDirectories: true)
        try "lazy".write(to: source.appendingPathComponent("lazy/chunk.js"), atomically: true, encoding: .utf8)
        let bootGuard = makeGuard(in: guardDirectory)
        bootAndAcknowledge(bootGuard, package: withLazy, source: source)

        let second = snapshotNames(in: guardDirectory)
        XCTAssertEqual(second.count, 1, "the previous snapshot is replaced")
        XCTAssertNotEqual(second, first)
        let fallback = try XCTUnwrap(bootGuard.lastGoodFallback())
        XCTAssertEqual(fallback.package.version, "1")
        XCTAssertEqual(try String(contentsOf: fallback.directory.appendingPathComponent("lazy/chunk.js"), encoding: .utf8), "lazy")
    }

    // MARK: - Bundle path for JS

    func testCurrentIndexBundleURLDoesNotRecordBoot() throws {
        try writePackageFile("index.jsa", content: "rendered")
        relaunch(guardEnabled: true)

        // The React Native bridge's getBundlePath only reports the path.
        let reported = manager.currentIndexBundleURL()
        _ = manager.currentIndexBundleURL()
        XCTAssertNil(try readGuardState()["pending"])

        // Loading the bundle (startApp / AirborneServices.getIndexBundlePath) records the boot.
        let loaded = manager.getIndexBundleURL()
        XCTAssertEqual(loaded, reported)
        let state = try readGuardState()
        XCTAssertEqual(state["pending"] as? String, "2.0.0")
        XCTAssertEqual(state["attempts"] as? Int, 1)
    }

    func testSecurityExclusionsPersistWithBootGuardOff() throws {
        let manifest = try XCTUnwrap(manager.getCurrentApplicationManifest() as? AJPApplicationManifest)
        manifest.blockedPackageVersions = ["1.0.0", "2.0.0"]
        manager.received(manifest)
        XCTAssertFalse(manager.allowPackage("1.0.0"))
        XCTAssertFalse(manager.allowPackage("2.0.0"))
        XCTAssertTrue(manager.allowPackage("3.0.0"))
        relaunch(guardEnabled: false)
        let current = try XCTUnwrap(manager.getCurrentApplicationManifest() as? AJPApplicationManifest)
        XCTAssertNotEqual(current.package.version, "2.0.0")
        XCTAssertFalse(manager.allowPackage("1.0.0"))
        XCTAssertFalse(manager.allowPackage("2.0.0"))
    }

    func testEmptyManifestDoesNotPersistTelemetryState() throws {
        let manifest = try XCTUnwrap(manager.getCurrentApplicationManifest() as? AJPApplicationManifest)
        manifest.blockedPackageVersions = []
        manager.received(manifest)
        XCTAssertFalse(FileManager.default.fileExists(atPath: manager.telemetryStateURLForTesting.path))
    }

    func testConcurrentManifestReceiptAndBootStateReads() throws {
        let manifest = try XCTUnwrap(manager.getCurrentApplicationManifest() as? AJPApplicationManifest)
        manifest.blockedPackageVersions = ["excluded"]
        DispatchQueue.concurrentPerform(iterations: 100) { index in
            if index % 2 == 0 { manager.received(manifest) }
            else {
                _ = manager.getCurrentApplicationManifest()
                _ = manager.getPathForPackageFile("index.jsa")
                _ = manager.readPackageFile("index.jsa")
            }
        }
        let saved = try JSONSerialization.jsonObject(with: Data(contentsOf: manager.telemetryStateURLForTesting)) as! [String: Any]
        XCTAssertEqual(saved["securityBlocked"] as? [String], ["excluded"])
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

    func testReadPackageFile_rejectsPathsOutsideThePackage() throws {
        // A file next to the package's main directory: "main/../outside.txt" would reach it.
        let outsidePath = fileUtil.fullPathInStorageForFilePath(
            "outside.txt", inFolder: AJPApplicationConstants.JUSPAY_PACKAGE_DIR)
        try "secret".write(toFile: outsidePath, atomically: true, encoding: .utf8)
        try writePackageFile("nested/inner.js", content: "inner")

        XCTAssertNil(manager.readPackageFile("../outside.txt"))
        XCTAssertNil(manager.readPackageFile("nested/../../outside.txt"))
        XCTAssertNil(manager.readPackageFile(outsidePath), "absolute paths are rejected")
        // A combining mark after "/" must not hide the separator (Character-based splitting would).
        XCTAssertFalse(AJPApplicationManager.isPackageRelativePath("../\u{0301}x"))
        XCTAssertFalse(AJPApplicationManager.isPackageRelativePath("a\u{0600}/../b"))
        XCTAssertEqual(manager.readPackageFile("nested/inner.js"), "inner")
    }

    func testCurrentReleaseConfigJSONMatchesTheManifestInBothFormats() throws {
        let manifest = try XCTUnwrap(manager.getCurrentApplicationManifest() as? AJPApplicationManifest)
        let expected = manifest.toDictionary() as NSDictionary

        let compact = try XCTUnwrap(manager.currentReleaseConfigJSON(prettyPrinted: false))
        let pretty = try XCTUnwrap(manager.currentReleaseConfigJSON(prettyPrinted: true))
        XCTAssertFalse(compact.contains("\n"), "the RN bridge gets compact JSON")
        XCTAssertTrue(pretty.contains("\n"), "AirborneServices keeps pretty-printed JSON")

        for json in [compact, pretty] {
            let parsed = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? NSDictionary
            XCTAssertEqual(parsed, expected)
        }
    }

    func testReadResourceFile_existingFile_returnsContent() throws {
        let name = "res_\(UUID().uuidString).js"
        try writePackageFile(name, content: "/* resource */")
        XCTAssertEqual(manager.readResourceFile(name), "/* resource */")
    }

    func testReadPackageFile_pathLeavingPackage_returnsNil() throws {
        // A real file one level above the package's main directory; readable if ".." were followed.
        let secret = "secret_\(UUID().uuidString).txt"
        try writePackageFile("../\(secret)", content: "outside")
        XCTAssertNil(manager.readPackageFile("../\(secret)"))
        XCTAssertNil(manager.readPackageFile("a/../../\(secret)"))
    }

    func testReadPackageFile_absolutePath_returnsNil() {
        XCTAssertNil(manager.readPackageFile("/etc/hosts"))
    }

    func testReadPackageFile_nestedRelativePath_returnsContent() throws {
        let name = "dir_\(UUID().uuidString)/nested.js"
        try writePackageFile(name, content: "/* nested */")
        XCTAssertEqual(manager.readPackageFile(name), "/* nested */")
    }

    // MARK: - isPackageRelativePath

    func testIsPackageRelativePath_acceptsRelativePaths() {
        for path in ["", "index.jsa", "a/b/c.js", "./index.jsa", "a/./b", "a//b", "a/",
                     "..a", "a..", "a..b", "a/..b/c", "a/b../c", "...", ".hidden", "a b/c d.js",
                     "%2e%2e/x", "~/x", "a\\b", "caf\u{E9}/index.js"] {
            XCTAssertTrue(AJPApplicationManager.isPackageRelativePath(path), "expected relative: \(path)")
        }
    }

    func testIsPackageRelativePath_rejectsAbsolutePaths() {
        for path in ["/", "/etc/hosts", "//x", "/index.jsa", "/../x"] {
            XCTAssertFalse(AJPApplicationManager.isPackageRelativePath(path), "expected absolute: \(path)")
        }
    }

    func testIsPackageRelativePath_rejectsParentComponents() {
        for path in ["..", "../x", "a/..", "a/../b", "a/b/../../c", "./..", "../..", "a//..//b", "x/../"] {
            XCTAssertFalse(AJPApplicationManager.isPackageRelativePath(path), "expected escape: \(path)")
        }
    }

    func testIsPackageRelativePath_combiningMarkCannotHideSeparator() {
        // "/" + U+0338 is a single Character, but at the file-system level it is still a separator.
        XCTAssertFalse(AJPApplicationManager.isPackageRelativePath("../\u{0338}x"))
        XCTAssertFalse(AJPApplicationManager.isPackageRelativePath("a/../\u{0338}x"))
        XCTAssertFalse(AJPApplicationManager.isPackageRelativePath("/\u{0338}x"))
        // A combining mark glued to ".." makes it an ordinary file name, not a parent reference.
        XCTAssertTrue(AJPApplicationManager.isPackageRelativePath("a/\u{0338}../x"))
        XCTAssertTrue(AJPApplicationManager.isPackageRelativePath("a/..\u{0338}/x"))
    }

    // MARK: - existingInstance(withWorkspace:)

    func testExistingInstance_returnsManagerCreatedForWorkspace() {
        XCTAssertTrue(AJPApplicationManager.existingInstance(withWorkspace: workspace) === manager)
    }

    func testExistingInstance_unknownWorkspace_returnsNil() {
        XCTAssertNil(AJPApplicationManager.existingInstance(withWorkspace: "never_created_\(UUID().uuidString)"))
    }

    // MARK: - currentReleaseConfigJSON

    func testCurrentReleaseConfigJSON_compactIsValidJSONWithSeededPackage() throws {
        let json = try XCTUnwrap(manager.currentReleaseConfigJSON(prettyPrinted: false))
        XCTAssertFalse(json.contains("\n"))
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
        let package = try XCTUnwrap(object["package"] as? [String: Any])
        XCTAssertEqual(package["name"] as? String, "parity-app")
        XCTAssertEqual(package["version"] as? String, "2.0.0")
    }

    func testCurrentReleaseConfigJSON_prettyPrintedHasNewlinesAndSameContent() throws {
        let compact = try XCTUnwrap(manager.currentReleaseConfigJSON(prettyPrinted: false))
        let pretty = try XCTUnwrap(manager.currentReleaseConfigJSON(prettyPrinted: true))
        XCTAssertTrue(pretty.contains("\n"))
        let a = try JSONSerialization.jsonObject(with: Data(compact.utf8)) as? NSDictionary
        let b = try JSONSerialization.jsonObject(with: Data(pretty.utf8)) as? NSDictionary
        XCTAssertEqual(a, b)
    }

    // MARK: - getIndexBundleURL

    func testGetIndexBundleURL_prefersIndexFileOnDisk() throws {
        try writePackageFile("index.jsa", content: "/* index */")
        let expected = manager.getPathForPackageFile("index.jsa")
        XCTAssertEqual(manager.getIndexBundleURL().path, URL(fileURLWithPath: expected).path)
    }

    func testGetIndexBundleURL_missingIndexFallsBackToBaseBundleLocation() {
        let url = manager.getIndexBundleURL()
        XCTAssertEqual(url.lastPathComponent, "index.jsa")
        XCTAssertEqual(url.deletingLastPathComponent().standardizedFileURL.path,
                       Bundle(for: Self.self).bundleURL.standardizedFileURL.path)
    }

    func testHostIndexBundleURL_defaultsToMainJsbundleUnderBundle() {
        let bundle = Bundle(for: Self.self)
        let url = AJPApplicationManager.hostIndexBundleURL(
            indexBundleName: AJPApplicationManager.defaultIndexBundleName, in: bundle)
        XCTAssertEqual(AJPApplicationManager.defaultIndexBundleName, "main.jsbundle")
        XCTAssertEqual(url.lastPathComponent, "main.jsbundle")
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

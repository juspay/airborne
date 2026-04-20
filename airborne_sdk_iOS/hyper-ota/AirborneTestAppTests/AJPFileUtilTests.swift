//
//  AJPFileUtilTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

final class AJPFileUtilTests: XCTestCase {

    var swiftUtil: AJPFileUtil!
    let workspace = "test_workspace"
    let testFileName = "test_file.txt"
    let folderName = "test_folder"
    let testData = "hello world".data(using: .utf8)!

    override func setUpWithError() throws {
        swiftUtil = AJPFileUtil(workspace: workspace, baseBundle: Bundle.main)
    }

    override func tearDownWithError() throws {
        try? swiftUtil.deleteFile(testFileName, inFolder: folderName)
        swiftUtil = nil
    }

    func testFullPathGeneration() throws {
        let swiftPath = swiftUtil.fullPathInStorageForFilePath(testFileName, inFolder: folderName)
        
        XCTAssertTrue(swiftPath.contains(workspace))
        XCTAssertTrue(swiftPath.contains(folderName))
    }
    
    func testFileSaveAndRead() throws {
        // Save using Swift
        try swiftUtil.saveFileWithData(testData, fileName: testFileName, folderName: folderName)
        
        // Read
        let swiftRead = try swiftUtil.getFileDataForFileName(testFileName, inFolder: folderName, withAssetsFromLocal: false)
        
        XCTAssertEqual(swiftRead, testData)
        
        // Delete using Swift
        XCTAssertNoThrow(try swiftUtil.deleteFile(testFileName, inFolder: folderName))
        
        // Ensure fail to read now
        XCTAssertThrowsError(try swiftUtil.getFileDataForFileName(testFileName, inFolder: folderName, withAssetsFromLocal: false))
    }
    
    func testFolderCreation() throws {
        let folderPath = swiftUtil.fullPathInStorageForFilePath("dummy.txt", inFolder: "test_creation_folder")
        let actualFolder = (folderPath as NSString).deletingLastPathComponent
        
        XCTAssertTrue(FileManager.default.fileExists(atPath: actualFolder))
        
        try? FileManager.default.removeItem(atPath: actualFolder)
    }

    func testLoadFile() throws {
        // Prepare dummy string data
        let content = "Secure String"
        let data = content.data(using: .utf8)!
        try swiftUtil.saveFileWithData(data, fileName: "load_test.txt", folderName: folderName)
        
        let swiftLoaded = try swiftUtil.loadFile("load_test.txt", folder: folderName, withLocalAssets: false)
        
        XCTAssertEqual(swiftLoaded, content)
    }
    
    func testNSCodingWriteAndRead() throws {
        let dummy = DummyCodingObject(value: "Secure Data Value")
        let fileName = "encoded_dummy.dat"
        
        // Write using Swift
        XCTAssertNoThrow(try swiftUtil.writeInstance(dummy, fileName: fileName, inFolder: folderName))
        
        // Read
        let swiftDecoded = try swiftUtil.getDecodedInstanceForClass(DummyCodingObject.self, withContentOfFileName: fileName, inFolder: folderName) as? DummyCodingObject
        
        XCTAssertNotNil(swiftDecoded)
        XCTAssertEqual(swiftDecoded?.value, "Secure Data Value")
    }
    
    func testMoveFileToInternalStorage() throws {
        let targetFileName = "moved_file.txt"
        let tempURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("source_file.tmp")
        try "Temporary Content".write(to: tempURL, atomically: true, encoding: .utf8)
        
        XCTAssertNoThrow(try swiftUtil.moveFileToInternalStorage(tempURL, fileName: targetFileName, folderName: folderName))
        
        let data = try swiftUtil.getFileDataFromInternalStorage(targetFileName, inFolder: folderName)
        XCTAssertEqual(String(data: data, encoding: .utf8), "Temporary Content")
    }
}

// Dummy class for NSCoding tests
@objc(DummyCodingObject)
class DummyCodingObject: NSObject, NSSecureCoding {
    static var supportsSecureCoding: Bool { return true }
    var value: String
    
    init(value: String) { self.value = value }
    
    func encode(with coder: NSCoder) {
        coder.encode(value, forKey: "val")
    }
    
    required init?(coder: NSCoder) {
        self.value = coder.decodeObject(of: NSString.self, forKey: "val") as? String ?? ""
    }
}

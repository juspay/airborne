//
//  AJPFileUtil.swift
//  Airborne
//

import Foundation

/// A utility class for local file IO operations.
/// Handles the core workspace abstractions, directory management, and generic decoding.
@objc open class AJPFileUtil: NSObject {
    
    private let workspace: String
    private let parentBundle: Bundle?
    
    @objc public let assetsBundle: Bundle?
    
    /// Initializes a new instance of AJPFileUtil.
    /// - Parameters:
    ///   - workspace: The name of the workspace folder.
    ///   - baseBundle: The parent bundle. If nil, it defaults to the main app bundle.
    @objc public init(workspace: String, baseBundle: Bundle?) {
        self.workspace = workspace
        self.parentBundle = baseBundle
        
        if let baseBundle = baseBundle,
           let pathForClientBundle = baseBundle.path(forResource: workspace, ofType: "bundle"),
           let embeddedBundle = Bundle(path: pathForClientBundle) {
            self.assetsBundle = embeddedBundle
        } else {
            self.assetsBundle = baseBundle
        }
        super.init()
    }
    
    // MARK: - File Path
    
    /// Returns the absolute bundle path for a file if it exists.
    /// It systematically checks the asset bundle, then the parent bundle, and finally the main app bundle.
    /// - Parameter fileName: The name of the file (including varying extensions) to search for.
    /// - Returns: The absolute path string within the Bundle, or nil if the file is not found.
    @objc public func filePathInBundleForFileName(_ fileName: String) -> String? {
        let fileNameComponents = fileName.components(separatedBy: ".")
        
        guard !fileNameComponents.isEmpty else { return nil }
        
        var fileNameString = ""
        for i in 0..<(fileNameComponents.count - 1) {
            if i == 0 {
                fileNameString = "\(fileNameComponents[i])"
            } else {
                fileNameString = "\(fileNameString).\(fileNameComponents[i])"
            }
        }
        
        let type = fileNameComponents.last
        
        if let path = assetsBundle?.path(forResource: fileNameString, ofType: type) {
            return path
        }
        
        if let path = parentBundle?.path(forResource: fileNameString, ofType: type) {
            return path
        }
        
        return Bundle.main.path(forResource: fileNameString, ofType: type)
    }
    
    /// Generates the absolute file path within the application's internal Sandbox library.
    /// - Parameters:
    ///   - filePath: The relative path or name of the file.
    ///   - folderName: An optional subfolder name to isolate the file.
    /// - Returns: The fully constructed absolute file path.
    @objc public func fullPathInStorageForFilePath(_ filePath: String, inFolder folderName: String?) -> String {
        let paths = NSSearchPathForDirectoriesInDomains(.libraryDirectory, .userDomainMask, true)
        guard var rootPath = paths.first else { return "" }
        
        if let folderName = folderName, !folderName.isEmpty {
            rootPath = (rootPath as NSString).appendingPathComponent(folderName)
        }
        
        rootPath = (rootPath as NSString).appendingPathComponent(self.workspace)
        
        let subPaths = filePath.components(separatedBy: "/")
        if subPaths.count > 1 {
            for i in 0..<(subPaths.count - 1) {
                rootPath = (rootPath as NSString).appendingPathComponent(subPaths[i])
            }
        }
        
        createFolderIfDoesNotExist(rootPath)
        
        return (rootPath as NSString).appendingPathComponent((filePath as NSString).lastPathComponent)
    }
    
    // MARK: - File Read
    
    /// Loads the text content of a file as a String.
    /// It searches either the internal storage or the application's bundle depending on the parameters.
    /// - Parameters:
    ///   - filePath: The name of the file to load.
    ///   - folder: The subfolder containing the file.
    ///   - local: If true, it skips internal storage and only checks the bundle.
    /// - Throws: An `NSError` if the file cannot be found or if its content isn't valid UTF-8.
    /// - Returns: The file's content as a String.
    @objc open func loadFile(_ filePath: String, folder: String, withLocalAssets local: Bool) throws -> String {
        var fileReadError: NSError? = nil
        let fileData: Data?
        
        do {
            fileData = try getFileDataForFileName(filePath, inFolder: folder, withAssetsFromLocal: local)
        } catch {
            fileData = nil
            fileReadError = error as NSError
        }
        
        guard let data = fileData else {
            throw fileReadError ?? NSError(domain: "in.juspay.Airborne", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Failed to read file content."])
        }
        
        guard let fileDataString = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "in.juspay.Airborne", code: 1002, userInfo: [NSLocalizedDescriptionKey: "Failed to convert file data to string."])
        }
        
        return fileDataString
    }
    
    /// Retrieves the raw Data of a file, checking internal storage first and falling back to the bundle.
    /// - Parameters:
    ///   - fileName: The name of the file to retrieve.
    ///   - folderName: The subfolder containing the file.
    ///   - local: If true, it skips internal storage and only checks the bundle.
    /// - Throws: An `NSError` if the file does not exist.
    /// - Returns: The file's raw Data.
    @objc public func getFileDataForFileName(_ fileName: String, inFolder folderName: String?, withAssetsFromLocal local: Bool) throws -> Data {
        if !local {
            if let data = try? getFileDataFromInternalStorage(fileName, inFolder: folderName) {
                return data
            }
        }
        return try getFileDataFromBundle((fileName as NSString).lastPathComponent)
    }
    
    /// Retrieves the raw Data of a file localized exclusively within the application's bundle.
    /// - Parameter fileName: The name of the file to retrieve.
    /// - Throws: An `NSError` if the file does not exist in the bundle.
    /// - Returns: The file's raw Data securely mapped into memory.
    @objc public func getFileDataFromBundle(_ fileName: String) throws -> Data {
        let fileManager = FileManager.default
        if let filePathInBundle = filePathInBundleForFileName(fileName), fileManager.fileExists(atPath: filePathInBundle) {
            return try Data(contentsOf: URL(fileURLWithPath: filePathInBundle), options: .mappedIfSafe)
        }
        throw NSError(domain: NSCocoaErrorDomain, code: NSFileReadNoSuchFileError, userInfo: nil)
    }
    
    /// Retrieves the raw Data of a file located solely in the application's internal storage sandbox.
    /// - Parameters:
    ///   - fileName: The name of the file to retrieve.
    ///   - folderName: The subfolder where the file is stored.
    /// - Throws: An `NSError` if the file does not exist.
    /// - Returns: The file's raw Data securely mapped into memory.
    @objc public func getFileDataFromInternalStorage(_ fileName: String, inFolder folderName: String?) throws -> Data {
        let fileManager = FileManager.default
        let filePath = fullPathInStorageForFilePath(fileName, inFolder: folderName)
        if fileManager.fileExists(atPath: filePath) {
            return try Data(contentsOf: URL(fileURLWithPath: filePath), options: .mappedIfSafe)
        }
        throw NSError(domain: NSCocoaErrorDomain, code: NSFileReadNoSuchFileError, userInfo: nil)
    }
    
    /// Reads and decodes an archived object from a file in the application's internal storage.
    /// - Parameters:
    ///   - className: The class type of the object you expect to decode (e.g., `MyModel.self`).
    ///   - fileName: The name of the file containing the archived data.
    ///   - folderName: The folder where the file is located within the workspace.
    /// - Throws: An `NSError` if the file cannot be read or if decoding fails.
    /// - Returns: The fully decoded object. You will typically cast it to your expected type after receiving it.
    @objc public func getDecodedInstanceForClass(_ className: AnyClass, withContentOfFileName fileName: String, inFolder folderName: String) throws -> Any {
        let fileData = try getFileDataFromInternalStorage(fileName, inFolder: folderName)
        guard let decoded = try NSKeyedUnarchiver.unarchivedObject(ofClasses: [className], from: fileData) else {
            throw NSError(domain: "in.juspay.Airborne", code: 1003, userInfo: [NSLocalizedDescriptionKey: "Failed to decode object or object was nil"])
        }
        return decoded
    }
    
    // MARK: - File Write
    
    /// Encodes an object that conforms to `NSCoding` and securely saves it to internal storage.
    /// - Parameters:
    ///   - object: The object to serialize and save.
    ///   - fileName: The target file name for the saved data.
    ///   - folderName: The subfolder to store the file in.
    /// - Throws: An `NSError` if the object fails to encode or if the file cannot be written.
    @objc public func writeInstance(_ object: NSSecureCoding, fileName: String, inFolder folderName: String?) throws {
        // Modern secure encoding
        let data = try NSKeyedArchiver.archivedData(withRootObject: object, requiringSecureCoding: true)
        try saveFileWithData(data, fileName: fileName, folderName: folderName)
    }
    
    /// Writes raw Data directly to a file in internal storage, atomically replacing any existing file.
    /// - Parameters:
    ///   - content: The raw Data to write.
    ///   - fileName: The target file name.
    ///   - folderName: The subfolder to store the file in.
    /// - Throws: An `NSError` if the file cannot be written.
    @objc public func saveFileWithData(_ content: Data, fileName: String, folderName: String?) throws {
        let filePath = fullPathInStorageForFilePath(fileName, inFolder: folderName)
        try content.write(to: URL(fileURLWithPath: filePath), options: .atomic)
    }
    
    /// Safely moves a file from a given source URL to the application's internal storage sandbox.
    /// If a file already exists at the destination, it is atomically replaced.
    /// - Parameters:
    ///   - source: The absolute URL of the external or temporary file to move.
    ///   - fileName: The intended file name (including extension) at the destination.
    ///   - folderName: An optional subfolder namespace within the workspace to isolate the file.
    /// - Throws: An `NSError` if the file manager fails to move or replace the item.
    @objc public func moveFileToInternalStorage(_ source: URL, fileName: String, folderName: String?) throws {
        let fileManager = FileManager.default
        let filePath = fullPathInStorageForFilePath(fileName, inFolder: folderName)
        let destinationURL = URL(fileURLWithPath: filePath)
        
        if fileManager.fileExists(atPath: filePath) {
            _ = try fileManager.replaceItemAt(destinationURL, withItemAt: source, backupItemName: nil, options: .usingNewMetadataOnly)
        } else {
            try fileManager.moveItem(at: source, to: destinationURL)
        }
    }
    
    /// Creates a directory at the specified path if it does not already exist.
    /// Intermediate directories are created automatically as needed.
    /// - Parameter folderName: The full absolute path where the directory should be created.
    @objc public func createFolderIfDoesNotExist(_ folderName: String) {
        guard !folderName.isEmpty else { return }
        let fileManager = FileManager.default
        if !fileManager.fileExists(atPath: folderName) {
            try? fileManager.createDirectory(atPath: folderName, withIntermediateDirectories: true, attributes: nil)
        }
    }
    
    /// Deletes a specific file from the application's internal storage sandbox.
    /// - Parameters:
    ///   - fileName: The name of the file to delete (including extension).
    ///   - folder: The subfolder namespace within the workspace where the file is located.
    /// - Throws: An `NSError` if the file manager fails to remove the item.
    @objc public func deleteFile(_ fileName: String, inFolder folder: String) throws {
        let path = fullPathInStorageForFilePath(fileName, inFolder: folder)
        try FileManager.default.removeItem(atPath: path)
    }
}

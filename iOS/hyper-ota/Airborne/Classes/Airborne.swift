//
//  Airborne.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation

@objc public protocol AirborneDelegate {
    
    @objc optional func namespace() -> String
    
    @objc optional func bundlePath() -> String
    
    @objc optional func dimensions() -> [String: String]
    
    @objc optional func onBootComplete() -> Void
    
    @objc optional func onEvent(level: String, label: String, key: String, value: [String: Any], category: String, subcategory: String) -> Void
}


@objc public class AirborneServices: NSObject {
    
    private let releaseConfigURL: String
    private lazy var namespace: String = {
        // TODO: Default namespace needs to be confirmed
        delegate?.namespace?() ?? "juspay"
    }()
    private lazy var dimensions: [String: String] = {
        delegate?.dimensions?() ?? [:]
    }()
    private lazy var bundlePath: String = {
        delegate?.bundlePath?() ?? Bundle.main.bundlePath
    }()
    
    private weak var delegate: AirborneDelegate?
    private var applicationManager: HPJPApplicationManager?
    
    @objc public init(releaseConfigURL: String, delegate: AirborneDelegate? = nil) {
        self.releaseConfigURL = releaseConfigURL
        self.delegate = delegate
        super.init()
        self.startApplicationManager()
    }
    
    private func startApplicationManager() {
        self.applicationManager = HPJPApplicationManager.getSharedInstance(withWorkspace: self.namespace, delegate: self, logger: self)
        self.applicationManager?.waitForPackagesAndResources { [weak self] _ in
            self?.delegate?.onBootComplete?()
        }
    }
}

extension AirborneServices {
    @objc public func getIndexBundlePath() -> String {
        guard
            let indexFilePath = self.applicationManager?.getCurrentApplicationManifest().package.index.filePath,
            !indexFilePath.isEmpty
        else {
            return self.bundlePath
        }
            
        guard
            let filePath = self.applicationManager?.getPathForPackageFile(indexFilePath),
            FileManager.default.fileExists(atPath: filePath)
        else {
            return self.bundlePath.appendPathComponent(indexFilePath)
        }
        
        return filePath
    }
    
    @objc public func getReleaseConfig() -> String {
        let manifest = self.applicationManager?.getCurrentApplicationManifest().toDictionary()
        guard let manifestDict = manifest as? [String: Any] else {
            return ""
        }
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: manifestDict, options: .prettyPrinted)
            return String(data: jsonData, encoding: .utf8) ?? ""
        } catch {
            debugPrint("Error converting manifest to JSON: \(error)")
            return ""
        }
    }
    
    @objc public func getFileContent(atPath path: String) -> String? {
        return applicationManager?.readPackageFile(path)
    }
}

extension AirborneServices: HPJPApplicationManagerDelegate {
    public func getReleaseConfigURL() -> String {
        self.releaseConfigURL
    }
    
    public func getReleaseConfigHeaders() -> [String : String] {
        self.dimensions
    }
}

extension AirborneServices: HPJPLoggerDelegate {
    // Required function. Not being used in ApplicationManager.
    public func trackEvent(withLevel level: String!, label: String!, value: Any!, category: String!, subcategory: String!) {
        
    }
    
    public func trackEvent(withLevel level: String!, label: String!, key: String!, value: Any!, category: String!, subcategory: String!) {
        let valueDict = value as? [String: Any] ?? [:]
        self.delegate?.onEvent?(level: level, label: label, key: key, value: valueDict, category: category, subcategory: subcategory)
    }
}

extension String {
    func appendPathComponent(_ pathComponent: String) -> String {
        return (self as NSString).appendingPathComponent(pathComponent)
    }
}

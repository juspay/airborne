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
    
    @objc optional func onEvent() -> Void
}


@objc public class AirborneServices: NSObject {
    
    private let releaseConfigURL: String
    private weak var delegate: AirborneDelegate?
    private var applicationManager: HPJPApplicationManager?
    
    @objc public init(releaseConfigURL: String, delegate: AirborneDelegate? = nil) {
        self.releaseConfigURL = releaseConfigURL
        self.delegate = delegate
        super.init()
        
        self.initializeDefaults()
        self.startApplicationManager()
    }
    
    private func initializeDefaults() {
        
    }
    
    private func startApplicationManager() {
        
    }
}

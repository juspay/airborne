//
//  AJPLoggerDelegate.swift
//  Airborne
//

import Foundation

@objc public protocol AJPLoggerDelegate: NSObjectProtocol {
    
    @objc func trackEvent(withLevel: String, label: String, key: String, value: Any, category: String, subcategory: String)
}

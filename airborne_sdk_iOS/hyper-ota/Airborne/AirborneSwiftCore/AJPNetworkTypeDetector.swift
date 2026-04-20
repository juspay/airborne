//
//  AJPNetworkTypeDetector.swift
//  Airborne
//

import Foundation
import Network
import CoreTelephony

/// Represents the type of network connection currently available on the device.
@objc public enum AJPNetworkType: Int {
    case noInternet = 0
    case wifi
    case cellular2G
    case cellular3G
    case cellular4G
    case cellular5G
    case unknown
}

/// Detects the current network connection type using NWPathMonitor and CoreTelephony.
/// Provides both an enum value and a human-readable string representation.
@objc public class AJPNetworkTypeDetector: NSObject {

    // MARK: - Public

    /// Returns the current network connection type as an enum value.
    /// - Returns: An `AJPNetworkType` value representing the current connection.
    @objc public static func currentNetworkType() -> AJPNetworkType {
        guard let path = getCurrentPath() else {
            return .unknown
        }

        // Check if internet is reachable
        guard path.status == .satisfied else {
            return .noInternet
        }

        // Check if connected via WiFi
        if path.usesInterfaceType(.wifi) {
            return .wifi
        }

        // Check if connected via cellular
        if path.usesInterfaceType(.cellular) {
            return getCellularNetworkType()
        }

        return .unknown
    }

    /// Returns a human-readable string describing the current network connection type.
    /// - Returns: A string such as "WiFi", "4G/LTE", "No Internet", etc.
    @objc public static func currentNetworkTypeString() -> String {
        let type = currentNetworkType()
        switch type {
        case .noInternet:
            return "No Internet"
        case .wifi:
            return "WiFi"
        case .cellular2G:
            return "2G"
        case .cellular3G:
            return "3G"
        case .cellular4G:
            return "4G/LTE"
        case .cellular5G:
            return "5G"
        case .unknown:
            return "Unknown"
        }
    }

    // MARK: - Private Helpers

    private static let monitorQueue = DispatchQueue(label: "in.juspay.Airborne.NetworkDetector")
    private static let pathLock = NSLock()
    private static var _cachedPath: NWPath?
    private static let firstPathSemaphore = DispatchSemaphore(value: 0)

    private static let monitorStarter: Void = {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { path in
            pathLock.lock()
            let wasNil = (_cachedPath == nil)
            _cachedPath = path
            pathLock.unlock()
            
            if wasNil {
                firstPathSemaphore.signal()
            }
        }
        monitor.start(queue: monitorQueue)
    }()

    /// Retrieves the current NWPath snapshot using NWPathMonitor.
    /// Caches the path for instantaneous reads and waits with a timeout for the first path update.
    /// - Returns: The current `NWPath`, or nil if timed out.
    private static func getCurrentPath() -> NWPath? {
        _ = monitorStarter
        
        pathLock.lock()
        let path = _cachedPath
        pathLock.unlock()
        
        if path != nil {
            return path
        }

        _ = firstPathSemaphore.wait(timeout: .now() + 0.5)
        
        pathLock.lock()
        let updatedPath = _cachedPath
        pathLock.unlock()
        
        return updatedPath
    }

    /// Determines the cellular network generation (2G/3G/4G/5G) using CoreTelephony.
    /// - Returns: An `AJPNetworkType` value representing the cellular generation.
    private static func getCellularNetworkType() -> AJPNetworkType {
        let networkInfo = CTTelephonyNetworkInfo()

        guard let serviceRadioTech = networkInfo.serviceCurrentRadioAccessTechnology else {
            return .unknown
        }

        for (_, radioTech) in serviceRadioTech {
            let type = networkType(for: radioTech)
            if type != .unknown {
                return type
            }
        }

        return .unknown
    }

    /// Maps a CoreTelephony radio access technology string to an `AJPNetworkType`.
    /// - Parameter radioTech: The radio access technology identifier string.
    /// - Returns: The corresponding `AJPNetworkType` value.
    private static func networkType(for radioTech: String?) -> AJPNetworkType {
        guard let radioTech = radioTech else {
            return .unknown
        }

        // 5G Technologies
        if #available(iOS 14.1, *) {
            if radioTech == CTRadioAccessTechnologyNR ||
               radioTech == CTRadioAccessTechnologyNRNSA {
                return .cellular5G
            }
        }

        // 4G/LTE Technologies
        if radioTech == CTRadioAccessTechnologyLTE {
            return .cellular4G
        }

        // 3G Technologies
        if radioTech == CTRadioAccessTechnologyWCDMA ||
           radioTech == CTRadioAccessTechnologyHSDPA ||
           radioTech == CTRadioAccessTechnologyHSUPA ||
           radioTech == CTRadioAccessTechnologyCDMA1x ||
           radioTech == CTRadioAccessTechnologyCDMAEVDORev0 ||
           radioTech == CTRadioAccessTechnologyCDMAEVDORevA ||
           radioTech == CTRadioAccessTechnologyCDMAEVDORevB ||
           radioTech == CTRadioAccessTechnologyeHRPD {
            return .cellular3G
        }

        // 2G Technologies
        if radioTech == CTRadioAccessTechnologyGPRS ||
           radioTech == CTRadioAccessTechnologyEdge {
            return .cellular2G
        }

        return .unknown
    }
}

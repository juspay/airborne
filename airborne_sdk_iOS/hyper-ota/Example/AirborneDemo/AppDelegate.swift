//
//  AppDelegate.swift
//  AirborneDemo
//
//  Created by Balaganesh Balaganesh on 27/06/25.
//  Copyright © 2025 yuvrajjsingh0. All rights reserved.
//

import UIKit
import Airborne

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    private var airborne: AirborneServices?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Initialize Airborne
        airborne = AirborneServices(releaseConfigURL: "https://yourdomain.com/release-config-url.json", delegate: self)
        
        return true
    }
}

// AirborneDelegate
extension AppDelegate: AirborneDelegate {
    func namespace() -> String {
        return "airborne-example"
    }
    
    func dimensions() -> [String : String] {
        ["city": "bangalore"]
    }
    
    func onLazyPackageDownloadComplete(downloadSuccess: Bool, url: String, filePath: String) {
        
    }
    
    func onAllLazyPackageDownloadsComplete() {
        
    }
    
    func onEvent(level: String, label: String, key: String, value: [String : Any], category: String, subcategory: String) {
        // Log the event
    }
    
    func startApp(indexBundleURL: URL?) {
        // Local file path URL for the available index bundle
    }
}


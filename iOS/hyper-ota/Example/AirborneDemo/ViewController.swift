//
//  ViewController.swift
//  AirborneDemo
//
//  Created by Balaganesh Balaganesh on 27/06/25.
//  Copyright © 2025 yuvrajjsingh0. All rights reserved.
//

import UIKit
import Airborne

class ViewController: UIViewController {

    var airborne: AirborneServices!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        self.view.backgroundColor = UIColor.gray
        let tossValue = Int.random(in: 1...100)
        let releaseConfigURL = "http://127.0.0.1:8081/release_config_16.json?toss=\(tossValue)"
        airborne = AirborneServices(releaseConfigURL: releaseConfigURL, delegate: self)
    }
}

extension ViewController: AirborneDelegate {
    
    func namespace() -> String {
        "airborne-demo"
    }
    
    func onBootComplete(indexBundleURL: URL?) {
        print("Index bundle path: \(String(describing: indexBundleURL))")
        let releaseConfig = airborne.getReleaseConfig()
        print("Release config: \(releaseConfig)")
    }
    
    func onEvent(level: String, label: String, key: String, value: [String : Any], category: String, subcategory: String) {
        let eventDict: [String: Any] = [
            "level": level,
            "label": label,
            "key": key,
            "value": value,
            "category": category,
            "subcategory": subcategory
        ]
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: eventDict, options: .prettyPrinted)
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                print(jsonString)
            }
        } catch {
            print("Error serializing event dictionary: \(error)")
            print(eventDict) // Fallback to basic print
        }
    }
}


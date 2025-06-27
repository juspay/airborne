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
        
        airborne = AirborneServices(releaseConfigURL: "https://airborne.juspay.in", delegate: self)
    }

}

extension ViewController: AirborneDelegate {
    
}


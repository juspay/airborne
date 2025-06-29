// iOS Integration example

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
import XCTest
@testable import Airborne

final class AirborneTests: XCTestCase {
    var airborne: AirborneServices!
    
    override func setUpWithError() throws {
        airborne = AirborneServices(releaseConfigURL: "")
    }
    
    override func tearDownWithError() throws {
        airborne = nil
    }
}
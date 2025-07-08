import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import AirborneReact

@main
class AppDelegate: UIResponder, UIApplicationDelegate, AirborneReactDelegate {
  var window: UIWindow?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Save launch options for later use
    self.launchOptions = launchOptions

    // Initialize HyperOTA first
    initializeHyperOTA()

    // Create the main window early
    self.window = UIWindow(frame: UIScreen.main.bounds)

    return true
  }

    @objc func onBootComplete(_ bundlePath: String) {
        DispatchQueue.main.async { [self] in

            let delegate = ReactNativeDelegate(customPath: bundlePath)
            let factory = RCTReactNativeFactory(delegate: delegate)
            delegate.dependencyProvider = RCTAppDependencyProvider()

            reactNativeDelegate = delegate
            reactNativeFactory = factory

            factory.startReactNative(
            withModuleName: "AirborneExample",
            in: window,
            launchOptions: self.launchOptions
            )

        }
    }
    
    func getNamespace() -> String {
        return "AirborneExample"
    }
    
    func getBundle() -> Bundle {
        return Bundle.main
    }

    func getDimensions() -> [String : String] {
    return [:]
  }

  func onEvent(
    withLevel level: String,
    label: String,
    key: String,
    value: [String : Any],
    category: String,
    subcategory: String
  ) {
      print("Event: \(key) = \(value)")
  }

  private func initializeHyperOTA() {
    Airborne.initializeAirborne(
      withReleaseConfigUrl: "https://airborne.sandbox.juspay.in/release/airborne-react-example/ios",
      delegate: self
    )
    print("HyperOTA: Initialized successfully")
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {

    private let customPath: String

    init(customPath: String) {
      self.customPath = customPath
      super.init()
    }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    URL(fileURLWithPath: customPath)
#endif
  }
}

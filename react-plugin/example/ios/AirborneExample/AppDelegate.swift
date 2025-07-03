import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import AirborneReact

@main
class AppDelegate: UIResponder, UIApplicationDelegate, AirborneReactDelegate, RCTBridgeDelegate {

  var window: UIWindow?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  var bridge: RCTBridge?
  var bundlePath: String?
    
    
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
    
    // Required by RCTBridgeDelegate – provides JS bundle path
    func sourceURL(for bridge: RCTBridge) -> URL? {
        guard let path = bundlePath else {
            fatalError("Bundle path is not set. Call onBootComplete(bundlePath:) first.")
        }
        return URL(fileURLWithPath: path)
    }

    @objc func onBootComplete(_ bundlePath: String) {
        DispatchQueue.main.async {
            self.bundlePath = bundlePath

            self.bridge = RCTBridge(delegate: self, launchOptions: nil)

            let rootView = RCTRootView(bridge: self.bridge!, moduleName: "AirborneExample", initialProperties: nil)
            rootView.backgroundColor = UIColor.white

            let rootViewController = UIViewController()
            rootViewController.view = rootView

            self.window = UIWindow(frame: UIScreen.main.bounds)
            self.window?.rootViewController = rootViewController
            self.window?.makeKeyAndVisible()
        }
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
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

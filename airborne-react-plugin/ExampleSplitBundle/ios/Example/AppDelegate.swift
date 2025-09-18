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

    // Initialize Airborne first
    initializeAirborne()

    // Create the main window early
    self.window = UIWindow(frame: UIScreen.main.bounds)

    return true
  }

  @objc func startApp(_ bundlePath: String) {
    DispatchQueue.main.async { [self] in
      let delegate = ReactNativeDelegate(customPath: bundlePath)
      let factory = RCTReactNativeFactory(delegate: delegate)
      delegate.dependencyProvider = RCTAppDependencyProvider()

      reactNativeDelegate = delegate
      reactNativeFactory = factory

      factory.startReactNative(
        withModuleName: "Example",
        in: window,
        launchOptions: self.launchOptions
      )
    }
  }

  func getDimensions() -> [String : String] {
    return ["split_bundle": "true"]
  }

  func onEvent(
    withLevel level: String,
    label: String,
    key: String,
    value: [String : Any],
    category: String,
    subcategory: String
  ) {
    print("Airborne Event: \(level) - \(label) - \(key) - \(value)")
  }

  private func initializeAirborne() {
    Airborne.initializeAirborne(
      withReleaseConfigUrl: "https://airborne.sandbox.juspay.in/release/airborne-react-example/ios",
      delegate: self
    )
    print("Airborne: Initialized successfully")
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  private let customPath: String?

  init(customPath: String? = nil) {
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
    if let customPath = customPath {
      return URL(fileURLWithPath: customPath)
    }
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

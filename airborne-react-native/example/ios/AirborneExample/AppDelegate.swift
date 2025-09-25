import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import AirborneReact

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    
    var reactNativeDelegate: ReactNativeDelegate?
    var reactNativeFactory: RCTReactNativeFactory?
    
    private var airborne: Airborne?
    
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
        
//        let delegate = ReactNativeDelegate(customPath: bundlePath)
//        let factory = RCTReactNativeFactory(delegate: delegate)
//        delegate.dependencyProvider = RCTAppDependencyProvider()
//        
//        reactNativeDelegate = delegate
//        reactNativeFactory = factory
//        
//        factory.startReactNative(
//            withModuleName: "AirborneExample",
//            in: window,
//            launchOptions: self.launchOptions
//        )
        
        
//        let delegate = ReactNativeDelegate()
//        let factory = RCTReactNativeFactory(delegate: delegate)
//        delegate.dependencyProvider = RCTAppDependencyProvider()
//
//        reactNativeDelegate = delegate
//        reactNativeFactory = factory
//
//        window = UIWindow(frame: UIScreen.main.bounds)
//
//        factory.startReactNative(
//          withModuleName: "AirborneExample",
//          in: window,
//          launchOptions: launchOptions
//        )

        return true
    }
    
    private func initializeHyperOTA() {
        airborne = Airborne(releaseConfigURL: "http://127.0.0.1:8080/release_config.json", delegate: self)
        print("HyperOTA: Initialized successfully")
    }
}

extension AppDelegate: AirborneDelegate {
    
    func namespace() -> String {
        return "airborneexample"
    }
    
    func bundle() -> Bundle {
        guard
            let bundleURL = Bundle.main.url(forResource: "airborneex", withExtension: "bundle"),
            let bundle = Bundle(url: bundleURL)
        else {
            fatalError("❌ Could not find airborneex.bundle in main bundle.")
        }

        return bundle
    }
    
    func dimensions() -> [String : String] {
        return [:]
    }
    
    func onEvent(level: String, label: String, key: String, value: [String : Any], category: String, subcategory: String) {
        print("Event: \(key) = \(value)")
    }
    

    func startApp(indexBundleURL: URL) -> Void {
        DispatchQueue.main.async { [self] in
            
            let bundlePath = indexBundleURL.absoluteString
            
            print("In start APP \(bundlePath)")
            let delegate = ReactNativeDelegate(bundleURL: indexBundleURL)
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

}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
    
    private let bundleUrl: URL
    
    init(bundleURL: URL) {
        self.bundleUrl = bundleURL
        super.init()
    }
    
    override func sourceURL(for bridge: RCTBridge) -> URL? {
        self.bundleURL()
    }
    
    override func bundleURL() -> URL? {
        
//        if let bundleURL = Bundle.main.url(forResource: "airborneex", withExtension: "bundle") {
//              return bundleURL.appendingPathComponent("main.jsbundle")
//          }
        
        return self.bundleUrl
    }
}

//class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
//  override func sourceURL(for bridge: RCTBridge) -> URL? {
//    self.bundleURL()
//  }
//
//  override func bundleURL() -> URL? {
//      
//      if let bundleURL = Bundle.main.url(forResource: "airborneex", withExtension: "bundle") {
//          return bundleURL.appendingPathComponent("main.jsbundle")
//      }
//      
//#if DEBUG
//    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
//#else
//    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
//#endif
//  }
//}

// Step 5: Implement AirborneDelegate extension

extension AppDelegate: AirborneDelegate {
    
    func getNamespace() -> String {
        return "<application/namespace-name>"
    }
    
    func getBundle() -> Bundle {
        return Bundle.main
    }
    
    func getDimensions() -> [String : String] {
        // Add custom dimensions for targeting, e.g.:
        // return ["app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""]
        return [:]
    }
    
    func onEvent(level: String, label: String, key: String, value: [String : Any], category: String, subcategory: String) {
        print("Event: \(key) = \(value)")
    }
    
    func startApp(indexBundleURL: URL?) {
        DispatchQueue.main.async { [self] in
            
            let delegate = ReactNativeDelegate(customPath: indexBundleURL)
            let factory = RCTReactNativeFactory(delegate: delegate)
            delegate.dependencyProvider = RCTAppDependencyProvider()
            
            reactNativeDelegate = delegate
            reactNativeFactory = factory
            
            factory.startReactNative(
                withModuleName: "YourAppName",  // Replace with your app name
                in: window,
                launchOptions: self.launchOptions
            )
            
        }
    }
}

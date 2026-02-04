// Step 6: Update existing ReactNativeDelegate class

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
    
    private let customPath: URL?
    
    init(customPath: URL?) {
        self.customPath = customPath
        super.init()
    }
    
    override func sourceURL(for bridge: RCTBridge) -> URL? {
        self.bundleURL()
    }
    
    override func bundleURL() -> URL? {
        customPath
    }
}

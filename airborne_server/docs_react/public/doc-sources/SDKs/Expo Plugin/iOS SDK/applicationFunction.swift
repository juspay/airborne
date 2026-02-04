// Step 4: Update application function in AppDelegate
// Note: In Expo, there are three application functions. Update only this one.

public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
) -> Bool {
    self.launchOptions = launchOptions
    
    // Initialize HyperOTA first
    initializeHyperOTA()
    
    // Create the main window early
    window = UIWindow(frame: UIScreen.main.bounds)
    
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
}

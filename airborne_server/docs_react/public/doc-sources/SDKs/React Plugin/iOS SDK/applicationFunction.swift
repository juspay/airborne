// Step 4: Update the body of application function in AppDelegate

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

// Step 3: Add these variables inside MainApplication class

class MainApplication : Application(), ReactApplication {

    private var bundlePath: String? = null
    var isBootComplete = false
    var bootCompleteListener: (() -> Unit)? = null
    private lateinit var airborneInstance: Airborne

    // ... rest of the class
}

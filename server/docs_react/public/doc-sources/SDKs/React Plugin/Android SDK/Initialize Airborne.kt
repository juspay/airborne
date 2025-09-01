private fun initializeAirborne() {
    try {
        airborneInstance = Airborne(
            this.applicationContext,
            "https://airborne.sandbox.juspay.in/release/airborne-react-example/ios",
            object : AirborneInterface() {

                override fun getDimensions(): HashMap<String, String> {
                    val map = HashMap<String, String>()
                    return map
                }

                override fun onEvent(
                    level: String,
                    label: String,
                    key: String,
                    value: JSONObject,
                    category: String,
                    subCategory: String
                ) {
                    // Log the event
                }

                override fun startApp(indexPath: String) {
                    isBootComplete = true
                    bundlePath = indexPath
                    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
                        // If you opted-in for the New Architecture, we load the native entry point for this app.
                        load()
                    }
                    bootCompleteListener?.invoke()
                }
            })
        Log.i("Airborne", "Airborne initialized successfully")
    } catch (e: Exception) {
        Log.e("Airborne", "Failed to initialize Airborne", e)
    }
}

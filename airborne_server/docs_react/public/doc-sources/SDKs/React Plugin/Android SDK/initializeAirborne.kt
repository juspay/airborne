// Step 6: Create initializeAirborne function in MainApplication

private fun initializeAirborne() {
    try {
        airborneInstance = Airborne(
            this.applicationContext,
            "https://airborne.juspay.in/release/<organisation-name>/<application/namespace-name>",
            object : AirborneInterface() {

                override fun getDimensions(): HashMap<String, String> {
                    val map = HashMap<String, String>()
                    // Add custom dimensions for targeting, e.g.:
                    // map["app_version"] = BuildConfig.VERSION_NAME
                    // map["user_segment"] = "premium"
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
                    // Log the event for debugging or analytics
                    Log.d("Airborne", "Event: $label - $key")
                }

                override fun startApp(indexPath: String) {
                    isBootComplete = true
                    bundlePath = indexPath
                    bootCompleteListener?.invoke()
                }
            })
        Log.i("Airborne", "Airborne initialized successfully")
    } catch (e: Exception) {
        Log.e("Airborne", "Failed to initialize Airborne", e)
    }
}

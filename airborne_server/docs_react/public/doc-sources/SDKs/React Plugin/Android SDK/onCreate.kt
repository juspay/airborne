// Step 7: Update onCreate in MainApplication

override fun onCreate() {
    super.onCreate()
    initializeAirborne()
    loadReactNative(this)
}

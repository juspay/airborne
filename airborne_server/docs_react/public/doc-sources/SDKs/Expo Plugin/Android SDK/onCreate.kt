// Step 6: Update onCreate in MainApplication

override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
        ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
        ReleaseLevel.STABLE
    }
    initializeAirborne()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
}

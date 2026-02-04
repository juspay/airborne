// Step 5: Update ReactHost in MainApplication

override val reactHost: ReactHost
    get() = AirborneReactNativeHostBase.getReactHost(applicationContext, reactNativeHost)

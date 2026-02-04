// Step 4: Update ReactNativeHost in MainApplication

override val reactNativeHost: ReactNativeHost =
    object : AirborneReactNativeHost(this@MainApplication) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
                // Packages that cannot be autolinked yet can be added manually here, for example:
                // add(MyReactNativePackage())
            }

        override fun getJSBundleFile(): String? {
            // This is delayed until mainActivity is created.
            // Make sure react is not booted until after bundlePath is created
            return airborneInstance.getBundlePath()
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }

// Step 4: Update ReactNativeHost in MainApplication

override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
    this,
    object : AirborneReactNativeHost(this@MainApplication) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
                // Packages that cannot be autolinked yet can be added manually here, for example:
                // add(MyReactNativePackage())
            }

        override fun getJSBundleFile(): String? {
            // Get bundle path from Airborne
            return airborneInstance.getBundlePath()
        }

        override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
    }
)

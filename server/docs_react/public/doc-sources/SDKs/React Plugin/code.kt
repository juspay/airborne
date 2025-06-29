package <package_name>

...
import com.hyperota.HyperotaModuleImpl

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    
    // Initialize HyperOTA before React Native
    initializeHyperOTA()
    
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
  }
  
  private fun initializeHyperOTA() {
    try {
      HyperotaModuleImpl.initializeHyperOTA(
        context = this,
        appId = "your-app-id", // Replace with your App ID
        indexFileName = "index.android.bundle",
        appVersion = BuildConfig.VERSION_NAME,
        releaseConfigTemplateUrl = "https://your-server.com/hyperota/release-config", // Replace with your release config URL
        headers = mapOf(
          "X-App-Version" to BuildConfig.VERSION_NAME,
          "X-Platform" to "Android"
        ),
        lazyDownloadCallback = null,
        trackerCallback = null
      )
      Log.i("HyperOTA", "HyperOTA initialized successfully")
    } catch (e: Exception) {
      Log.e("HyperOTA", "Failed to initialize HyperOTA", e)
    }
  }
}
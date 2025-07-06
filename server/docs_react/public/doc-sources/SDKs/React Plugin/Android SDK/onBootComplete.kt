override fun onBootComplete(indexPath: String) {
    isBootComplete = true
    bundlePath = indexPath
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
        // If you opted-in for the New Architecture, we load the native entry point for this app.
        load()
    }
    bootCompleteListener?.invoke()
}

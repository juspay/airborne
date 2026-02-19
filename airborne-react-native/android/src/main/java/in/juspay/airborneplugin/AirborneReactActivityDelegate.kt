package `in`.juspay.airborneplugin

import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.defaults.DefaultReactActivityDelegate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AirborneReactActivityDelegate(
    activity: ReactActivity,
    mainComponentName: String,
    fabricEnabled: Boolean
) : DefaultReactActivityDelegate(activity, mainComponentName, fabricEnabled) {

    private var appState = AppState.BEFORE_APPLOAD
    private val TAG = "AirborneReactActivityDelegate"
    override fun loadApp(appKey: String?) {
        if (reactNativeHost is AirborneReactNativeHost) {
            CoroutineScope(Dispatchers.Default).launch {

                // The wait for bundle update
                (reactNativeHost as AirborneReactNativeHost).jsBundleFile

                CoroutineScope(Dispatchers.Main).launch {
                    callLoadApp(appKey)
                }
            }
        } else {
            callLoadApp(appKey)
        }
    }

    private fun callLoadApp(appKey: String?) {
        super.loadApp(appKey)
        appState = AppState.APP_LOADED
        onResume()
    }

    override fun onPause() {
        try {
            if (appState == AppState.ONRESUME_CALLED) {
                super.onPause()
            } else {
                Log.d(TAG, "skipping onPause as onResume is not yet called")
            }
        } catch (e: Exception) {
            Log.e( TAG, "Exception in onPause: ${e.message}")
        }
    }

    override fun onResume() {
        try {
            if (appState == AppState.APP_LOADED || appState == AppState.ONRESUME_CALLED) {
                super.onResume()
                appState = AppState.ONRESUME_CALLED
            } else {
                Log.d(TAG, "skipping onResume as app is not yet loaded")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception in onResume: ${e.message}")
        }
    }

    override fun onDestroy() {
        try {
            if (appState == AppState.ONRESUME_CALLED) {
                super.onDestroy()
            } else {
                Log.d(TAG, "skipping onDestroy as onResume is not yet called")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception in onDestroy: ${e.message}")
        }
    }

    enum class AppState {
        BEFORE_APPLOAD,
        APP_LOADED,
        ONRESUME_CALLED
    }
}

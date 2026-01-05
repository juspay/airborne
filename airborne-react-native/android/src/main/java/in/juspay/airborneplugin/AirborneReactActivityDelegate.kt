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
    /**
     * Initiates loading of the React Native application, waiting for an updated JS bundle first when the host is an AirborneReactNativeHost.
     *
     * If the activity's ReactNativeHost is an AirborneReactNativeHost, this method waits for the host's JS bundle to become available on a background dispatcher and then invokes app loading on the main thread. Otherwise, it starts loading immediately.
     *
     * @param appKey The optional component key to load; pass `null` to let the host determine the default component. 
     */
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

    /**
     * Loads the React application for the given component key, marks the app as loaded, and advances lifecycle by invoking `onResume`.
     *
     * @param appKey The optional component key to load, or `null` to load the default entry. */
    private fun callLoadApp(appKey: String?) {
        super.loadApp(appKey)
        appState = AppState.APP_LOADED
        onResume()
    }

    /**
     * Pauses the React activity only when the delegate has recorded that onResume was called; otherwise logs that the pause was skipped.
     *
     * Any exceptions thrown while attempting to pause are caught and logged. 
     */
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

    /**
     * Resumes the React activity if the app has finished loading and updates the internal app state.
     *
     * If the internal state equals APP_LOADED, calls super.onResume() and sets the state to ONRESUME_CALLED; otherwise skips resuming and logs a debug message.
     *
     * Exceptions thrown during resume are caught and logged.
     */
    override fun onResume() {
        try {
            if (appState == AppState.APP_LOADED) {
                super.onResume()
                appState = AppState.ONRESUME_CALLED
            } else {
                Log.d(TAG, "skipping onResume as app is not yet loaded")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception in onResume: ${e.message}")
        }
    }

    /**
     * Performs destruction only if the delegate previously completed onResume.
     *
     * If the current app state is `ONRESUME_CALLED`, forwards the call to `super.onDestroy()`;
     * otherwise logs a debug message that onDestroy is being skipped. Any exception thrown
     * during the process is caught and logged as an error.
     */
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
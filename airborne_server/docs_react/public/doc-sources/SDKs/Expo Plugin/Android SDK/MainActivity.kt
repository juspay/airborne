// Step 1: Update createReactActivityDelegate in MainActivity.kt

import `in`.juspay.airborneplugin.AirborneReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return ReactActivityDelegateWrapper(
            this,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            AirborneReactActivityDelegate(
                this,
                mainComponentName,
                fabricEnabled
            )
        )
    }
}

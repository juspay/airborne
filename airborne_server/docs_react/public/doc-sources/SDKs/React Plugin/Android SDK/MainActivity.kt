// Step 1: Update MainActivity.kt

import `in`.juspay.airborneplugin.AirborneReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "YourAppName"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        AirborneReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

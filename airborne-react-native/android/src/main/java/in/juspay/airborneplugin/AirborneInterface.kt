package `in`.juspay.airborneplugin

import `in`.juspay.airborne.LazyDownloadCallback
import `in`.juspay.airborneplugin.Airborne.Companion.defaultLazyCallback
import org.json.JSONObject

abstract class AirborneInterface {
    open fun getNamespace(): String {
        return "airborne-example"
    }

    open fun getDimensions(): HashMap<String, String> {
        return hashMapOf()
    }

    open fun startApp(indexPath: String) {
    }

    open fun onEvent(level: String, label: String, key: String, value: JSONObject, category: String, subCategory: String) {
    }

    open fun getLazyDownloadCallback(): LazyDownloadCallback {
        return defaultLazyCallback
    }
}

// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package `in`.juspay.airborne.services

import android.content.Context
import `in`.juspay.airborne.TrackerCallback
import `in`.juspay.airborne.constants.Labels
import `in`.juspay.airborne.constants.LogCategory
import `in`.juspay.airborne.constants.LogLevel
import `in`.juspay.airborne.constants.LogSubCategory
import `in`.juspay.airborne.constants.OTAConstants
import org.json.JSONObject

class OTAServices(private val ctx: Context, val workspace: Workspace, val cleanUpValue: String, val useBundledAssets: Boolean, val trackerCallback: TrackerCallback, val fromAirborne: Boolean = true) {
    val fileProviderService: FileProviderService = FileProviderService(this)
    val remoteAssetService: RemoteAssetService = RemoteAssetService(this)
    var clientId: String? = null

    init {
        firstTimeCleanup()
    }

    private fun firstTimeCleanup() {
        val prevBuildId = workspace.getFromSharedPreference(OTAConstants.OTA_BUILD_ID, "__failed")

        if (prevBuildId != cleanUpValue) {
            trackerCallback.track(
                LogCategory.LIFECYCLE,
                LogSubCategory.LifeCycle.AIRBORNE,
                LogLevel.INFO,
                Labels.Airborne.FIRST_TIME_SETUP,
                "started",
                JSONObject().put("status", "started")
            )
            workspace.writeToSharedPreference(OTAConstants.OTA_BUILD_ID, cleanUpValue)
            workspace.removeFromSharedPreference("asset_metadata.json")
            try {
                ctx.let { workspace.clean(it) }
                trackerCallback.track(
                    LogCategory.LIFECYCLE,
                    LogSubCategory.LifeCycle.AIRBORNE,
                    LogLevel.INFO,
                    Labels.Airborne.FIRST_TIME_SETUP,
                    "completed",
                    JSONObject().put("status", "completed")
                )
            } catch (e: Exception) {
//                 Handles JSONException and Security exception
                trackerCallback.trackAndLogException(
                    TAG,
                    LogCategory.LIFECYCLE,
                    LogSubCategory.LifeCycle.AIRBORNE,
                    Labels.Airborne.FIRST_TIME_SETUP,
                    "Exception in firstTimeCleanUp",
                    e
                )
            }
        }
    }

    companion object {
        const val TAG = "OTAServices"
    }
}

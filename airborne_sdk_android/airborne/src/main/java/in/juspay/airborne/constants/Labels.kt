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

package `in`.juspay.airborne.constants

import androidx.annotation.Keep

object Labels {
    @Keep
    object Airborne {
        const val FIRST_TIME_SETUP = "first_time_setup"
    }

    object System {
        const val FILE_PROVIDER_SERVICE = "file_provider_service"
        const val REMOTE_ASSET_SERVICE = "remote_asset_service"
    }

    object Network {
        const val CANCEL_API = "cancel_api"
    }
}

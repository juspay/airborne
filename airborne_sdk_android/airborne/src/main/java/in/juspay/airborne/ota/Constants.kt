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

package `in`.juspay.airborne.ota

import org.json.JSONObject

internal object Constants {
    const val APP_DIR = "app"
    const val PACKAGE_DIR_NAME = "package"
    const val RESOURCES_DIR_NAME = "resources"
    const val BACKUP_DIR = "airborne-backup"
    const val BACKUP_TEMP = "backup_temp"
    const val BACKUP_MAIN = "backup"
    const val ROLLBACK_IN_PROGRESS = "rollback_in_progress"
    const val BLACKLISTED_VERSIONS = "blacklisted_versions"
    const val RC_VERSION_FILE_NAME = "rc_version.txt"
    const val PACKAGE_MANIFEST_FILE_NAME = "pkg.json"
    const val CONFIG_FILE_NAME = "config.json"
    const val RESOURCES_FILE_NAME = "resources.json"
    const val DEFAULT_VERSION = "1"
    val DEFAULT_CONFIG = ReleaseConfig.Config(
        version = "v000000",
        releaseConfigTimeout = 3000L,
        bootTimeout = 7000L,
        properties = JSONObject()
    )
    val DEFAULT_PKG = ReleaseConfig.PackageManifest(
        name = "",
        version = "v000000",
        index = null,
        properties = JSONObject(),
        important = emptyList(),
        lazy = emptyList()
    )
    val DEFAULT_RESOURCES = ReleaseConfig.ResourceManifest(emptyList())
    const val BACKUP_STAGE = "backup_stage"
    const val BACKUP_INPLACE = "backup_inplace"
}

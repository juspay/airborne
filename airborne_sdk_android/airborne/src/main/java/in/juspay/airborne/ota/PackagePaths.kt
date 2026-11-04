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

import java.io.File

/**
 * The one rule for package-relative paths that come from outside the SDK (JS, release configs).
 * Public so the React Native plugin can check JS-supplied paths with it.
 */
object PackagePaths {
    private val DRIVE_LETTER = Regex("^[A-Za-z]:")

    /**
     * @return true when [path] is a non-empty relative path with no '..' component: not
     *   absolute, no leading '/' or backslash, no drive letter (`C:`), and components are split
     *   on both '/' and backslash.
     */
    @JvmStatic
    fun isPackageRelativePath(path: String): Boolean {
        if (path.isEmpty() || path.startsWith('/') || path.startsWith('\\')) {
            return false
        }
        if (DRIVE_LETTER.containsMatchIn(path) || File(path).isAbsolute) {
            return false
        }
        return path.split('/', '\\').none { it == ".." }
    }
}

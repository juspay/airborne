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

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PackagePathsTest {
    @Test
    fun packageRelativePathsRejectEscapesAndAbsolutePaths() {
        listOf(
            "",
            "..",
            "../x",
            "a/../../x",
            "a\\..\\..\\x",
            "a/..",
            "/abs",
            "\\abs",
            "\\\\server\\share\\x",
            "C:\\x",
            "C:/x",
            "c:x"
        ).forEach { path -> assertFalse(path, PackagePaths.isPackageRelativePath(path)) }
    }

    @Test
    fun packageRelativePathsAcceptNestedFiles() {
        listOf(
            "index.android.bundle",
            "a/b/c.js",
            "a\\b.js",
            "assets/logo.png",
            "a..b/c.js",
            "..a/b.js",
            "./a.js"
        ).forEach { path -> assertTrue(path, PackagePaths.isPackageRelativePath(path)) }
    }
}

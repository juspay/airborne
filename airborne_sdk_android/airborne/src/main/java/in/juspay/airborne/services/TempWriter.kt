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

import java.io.File
import java.io.FileNotFoundException

class TempWriter internal constructor(s: String, m: FileProviderService.Mode, private val otaServices: OTAServices) {
    private val tempDir: File
    private val fileProviderService = otaServices.fileProviderService
    private val LOG_TAG = "TEMP_WRITER"

    init {
        when (m) {
            FileProviderService.Mode.NEW -> {
                val name = String.format("temp-%s-%s", s, System.currentTimeMillis())
                tempDir = otaServices.workspace.openInCache(name)
                tempDir.mkdir()
            }

            FileProviderService.Mode.RE_OPEN -> {
                tempDir = otaServices.workspace.openInCache(s)
                if (!tempDir.exists()) {
                    throw FileNotFoundException("$s does not exist in cache!")
                }
            }
        }
    }

    fun write(fileName: String, content: ByteArray): Boolean {
        val f = File(tempDir, fileName)
        f.parentFile?.mkdirs()
        return fileProviderService.writeToFile(f, content, false)
    }

    val dirName: String
        get() = tempDir.name

    fun list(): Array<String>? {
        return fileProviderService.listFilesRecursive(tempDir)
    }

    fun copyToMain(fileName: String, dest: String): Boolean {
        return if (!otaServices.fromAirborne) {
            otaServices.fileProviderService.hyperFileUtil.copyFile(tempDir, dest, fileName)
        } else {
            val from = File(tempDir, fileName)
            val to = fileProviderService.getFileFromInternalStorage("$dest/$fileName")
            fileProviderService.copyFile(from, to)
        }
    }
}

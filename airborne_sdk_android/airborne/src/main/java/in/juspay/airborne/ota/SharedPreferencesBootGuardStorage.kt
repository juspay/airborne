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

import android.content.SharedPreferences

/** Persists [BootGuard.State] as flat keys in a dedicated SharedPreferences file. */
internal class SharedPreferencesBootGuardStorage(
    private val prefs: SharedPreferences
) : BootGuard.Storage {

    override fun load(): BootGuard.State? {
        if (prefs.all.isEmpty()) {
            return null
        }
        return BootGuard.State(
            binaryIdentity = string(Key.BINARY_IDENTITY),
            pending = string(Key.PENDING),
            attempts = prefs.getInt(Key.ATTEMPTS, 0),
            blocked = string(Key.BLOCKED),
            lastGood = loadLastGood()
        )
    }

    override fun save(state: BootGuard.State): Boolean {
        val editor = prefs.edit()
            .clear()
            .putString(Key.BINARY_IDENTITY, state.binaryIdentity)
            .putString(Key.PENDING, state.pending)
            .putInt(Key.ATTEMPTS, state.attempts)
            .putString(Key.BLOCKED, state.blocked)
        state.lastGood?.let { lastGood ->
            editor
                .putString(Key.LAST_GOOD_VERSION, lastGood.version)
                .putString(Key.LAST_GOOD_INDEX, lastGood.indexPath)
                .putString(Key.LAST_GOOD_CONFIG, lastGood.config)
                .putString(Key.LAST_GOOD_SNAPSHOT, lastGood.snapshot)
        }
        // commit(), not apply(), even though prepareBoot reaches this on the UI thread (via
        // getBundlePath): the boot attempt must be on disk before JS runs. apply() writes
        // asynchronously, so a crash during startup could lose the attempt and the crashing
        // package would never be counted, blocked or rolled back.
        return editor.commit()
    }

    override fun clear(): Boolean = prefs.edit().clear().commit()

    private fun loadLastGood(): BootGuard.LastGood? {
        val version = string(Key.LAST_GOOD_VERSION)
        val config = string(Key.LAST_GOOD_CONFIG)
        val snapshot = string(Key.LAST_GOOD_SNAPSHOT)
        if (version.isEmpty() || config.isEmpty() || snapshot.isEmpty()) {
            return null
        }
        return BootGuard.LastGood(version, string(Key.LAST_GOOD_INDEX), config, snapshot)
    }

    private fun string(key: String): String = prefs.getString(key, null) ?: ""

    private object Key {
        const val BINARY_IDENTITY = "binary_identity"
        const val PENDING = "pending"
        const val ATTEMPTS = "attempts"
        const val BLOCKED = "blocked"
        const val LAST_GOOD_VERSION = "last_good_version"
        const val LAST_GOOD_INDEX = "last_good_index"
        const val LAST_GOOD_CONFIG = "last_good_config"
        const val LAST_GOOD_SNAPSHOT = "last_good_snapshot"
    }
}

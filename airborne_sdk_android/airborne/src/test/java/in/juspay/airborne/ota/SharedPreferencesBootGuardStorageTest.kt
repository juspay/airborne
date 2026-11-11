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
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedPreferencesBootGuardStorageTest {
    private val prefs = FakeSharedPreferences()
    private val storage = SharedPreferencesBootGuardStorage(prefs)

    private val full = BootGuard.State(
        binaryIdentity = "1.0+1",
        pending = "A",
        attempts = 1,
        blocked = "B",
        lastGood = BootGuard.LastGood("L", "index.android.bundle", "{\"config\":1}", "airborne-good-1")
    )

    @Test
    fun emptyPrefsLoadAsNull() {
        assertNull(storage.load())
    }

    @Test
    fun fullStateRoundTrips() {
        assertTrue(storage.save(full))

        assertEquals(full, storage.load())
        // A fresh instance over the same file reads the same state.
        assertEquals(full, SharedPreferencesBootGuardStorage(prefs).load())
    }

    @Test
    fun savingWithoutLastGoodRemovesTheOldOne() {
        storage.save(full)

        storage.save(full.copy(lastGood = null))

        assertEquals(full.copy(lastGood = null), storage.load())
        assertTrue(prefs.all.keys.none { it.startsWith("last_good") })
    }

    @Test
    fun partialLastGoodLoadsAsNull() {
        storage.save(full)
        prefs.edit().remove("last_good_snapshot").commit()

        val loaded = storage.load()!!

        assertNull(loaded.lastGood)
        assertEquals(full.copy(lastGood = null), loaded)
    }

    @Test
    fun clearRemovesEverything() {
        storage.save(full)

        assertTrue(storage.clear())

        assertTrue(prefs.all.isEmpty())
        assertNull(storage.load())
    }

    /** In-memory SharedPreferences with the platform's commit semantics (clear() applies first). */
    private class FakeSharedPreferences : SharedPreferences {
        private val values = HashMap<String, Any?>()

        override fun getAll(): Map<String, *> = HashMap(values)

        override fun getString(key: String, defValue: String?): String? =
            values[key] as? String ?: defValue

        @Suppress("UNCHECKED_CAST")
        override fun getStringSet(key: String, defValues: Set<String>?): Set<String>? =
            values[key] as? Set<String> ?: defValues

        override fun getInt(key: String, defValue: Int): Int = values[key] as? Int ?: defValue

        override fun getLong(key: String, defValue: Long): Long = values[key] as? Long ?: defValue

        override fun getFloat(key: String, defValue: Float): Float = values[key] as? Float ?: defValue

        override fun getBoolean(key: String, defValue: Boolean): Boolean =
            values[key] as? Boolean ?: defValue

        override fun contains(key: String): Boolean = values.containsKey(key)

        override fun edit(): SharedPreferences.Editor = Editor()

        override fun registerOnSharedPreferenceChangeListener(
            listener: SharedPreferences.OnSharedPreferenceChangeListener
        ) = Unit

        override fun unregisterOnSharedPreferenceChangeListener(
            listener: SharedPreferences.OnSharedPreferenceChangeListener
        ) = Unit

        private inner class Editor : SharedPreferences.Editor {
            private val changes = LinkedHashMap<String, Any?>()
            private val removals = HashSet<String>()
            private var clear = false

            private fun put(key: String, value: Any?) = apply {
                removals.remove(key)
                changes[key] = value
            }

            override fun putString(key: String, value: String?) = put(key, value)

            override fun putStringSet(key: String, values: Set<String>?) = put(key, values?.toSet())

            override fun putInt(key: String, value: Int) = put(key, value)

            override fun putLong(key: String, value: Long) = put(key, value)

            override fun putFloat(key: String, value: Float) = put(key, value)

            override fun putBoolean(key: String, value: Boolean) = put(key, value)

            override fun remove(key: String) = apply {
                changes.remove(key)
                removals.add(key)
            }

            override fun clear() = apply { clear = true }

            override fun commit(): Boolean {
                if (clear) {
                    values.clear()
                }
                removals.forEach { values.remove(it) }
                changes.forEach { (key, value) ->
                    if (value == null) values.remove(key) else values[key] = value
                }
                return true
            }

            override fun apply() {
                commit()
            }
        }
    }
}

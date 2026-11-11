// Copyright 2026 Juspay Technologies. Apache-2.0.
package `in`.juspay.airborne.ota

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import `in`.juspay.airborne.HyperOTAServices
import `in`.juspay.airborne.TrackerCallback
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class SecurityExclusionsTest {
    private val tracker = object : TrackerCallback() {
        override fun track(category: String, subCategory: String, level: String, label: String, key: String, value: JSONObject) {}
        override fun trackException(category: String, subCategory: String, label: String, description: String, e: Throwable) {}
    }
    private val manifest = """{"version":"2","config":{"version":"test","release_config_timeout":1000,"boot_timeout":1000,"properties":{}},"package":{"name":"test","version":"1","index":{"url":"https://example.test/index","file_path":"index"},"important":[],"lazy":[],"properties":{}},"resources":[],"blocked_package_versions":["1","2"],"telemetry":{"receipt":"test","expires_at":1,"ingest_path":"/api/telemetry/reports"}}"""
    @Test fun emptyManifestDoesNotPersistBootStateOrDisableCleanup() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val ns = "cleanup-${UUID.randomUUID()}"
        val m = HyperOTAServices(ctx, ns, "2.8.0", "https://example.test/release", tracker).createApplicationManager()
        val rc = ReleaseConfig.deSerialize(manifest.replace("[\"1\",\"2\"]", "[]")).getOrThrow()
        val received = m.javaClass.getDeclaredMethod("received", ReleaseConfig::class.java).apply { isAccessible = true }
        received.invoke(m, rc)
        assertFalse(ctx.getSharedPreferences("airborne-telemetry-$ns", Context.MODE_PRIVATE).contains("state"))
        val bootState = m.javaClass.getDeclaredField("bootState").apply { isAccessible = true }
        bootState.set(m, JSONObject().put("securityBlocked", org.json.JSONArray()))
        val cleanup = m.javaClass.getDeclaredMethod("runCleanUp", JSONObject::class.java, UpdateResult::class.java).apply { isAccessible = true }
        for (guard in listOf(false, true)) {
            m.bootGuardEnabled = guard
            val services = m.javaClass.getDeclaredField("otaServices").apply { isAccessible = true }.get(m) as `in`.juspay.airborne.services.OTAServices
            val file = services.fileProviderService.getFileFromInternalStorage("app/package/obsolete.js")
            file.parentFile?.mkdirs(); file.writeText("old")
            cleanup.invoke(m, JSONObject(), UpdateResult.Ok(rc))
            assertFalse(file.exists())
        }
    }
    @Test fun nestedWorkspaceDoesNotCrashPreferences() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        HyperOTAServices(ctx, "nested/${UUID.randomUUID()}", "2.8.0", "https://example.test/release", tracker).createApplicationManager()
    }
    @Test fun telemetryResolvesCallbackReleaseOrigin() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val m = HyperOTAServices(ctx, "callback-${UUID.randomUUID()}", "2.8.0", "", tracker).createApplicationManager()
        m.setReleaseConfigCallback(object : ReleaseConfigCallback {
            override fun shouldRetry() = false
            override fun getReleaseConfig(fetchFailed: Boolean) = "https://callback.example/release/app"
        })
        val endpoint = m.javaClass.getDeclaredMethod("reportEndpoint", JSONObject::class.java).apply { isAccessible = true }
        assertEquals("https://callback.example/api/telemetry/reports", endpoint.invoke(m, JSONObject().put("ingest_path", "/api/telemetry/reports")).toString())
    }
    @Test fun metadataSurvivesSavedManifestRoundTrip() {
        val rc = ReleaseConfig.deSerialize(manifest).getOrThrow()
        val saved = ReleaseConfig.deSerialize(rc.serialize()).getOrThrow()
        assertEquals(listOf("1", "2"), saved.blockedPackageVersions)
        assertEquals("test", saved.telemetry?.getString("receipt"))
    }
    @Test fun persistedExclusionsDenyCurrentAndLastGoodWithGuardOffAfterRestart() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val ns = "security-${UUID.randomUUID()}"
        val prefs = ctx.getSharedPreferences("airborne-telemetry-$ns", Context.MODE_PRIVATE)
        prefs.edit().putString("state", JSONObject().put("securityBlocked", org.json.JSONArray(listOf("1","2"))).put("lastGood",manifest).toString()).commit()
        fun manager() = HyperOTAServices(ctx, ns, "2.8.0", "https://example.test/release", tracker).createApplicationManager()
        fun allowed(m: ApplicationManager, v: String): Boolean {
            val method=m.javaClass.getDeclaredMethod("allowPackage",String::class.java);method.isAccessible=true
            return method.invoke(m,v) as Boolean
        }
        val first=manager(); assertFalse(first.bootGuardEnabled)
        assertFalse(allowed(first,"1"));assertFalse(allowed(first,"2"));assertTrue(allowed(first,"3"))
        val restarted=manager();assertFalse(allowed(restarted,"1"));assertFalse(allowed(restarted,"2"))
        assertEquals(2,JSONObject(prefs.getString("state","{}")!!).getJSONArray("securityBlocked").length())
    }
}

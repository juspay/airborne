package `in`.juspay.airborne.ota

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * WorkManager worker for background OTA bundle downloads.
 * Triggered by FCM push notifications — survives process death,
 * retries with exponential backoff, and has no time limit.
 *
 * When the download completes, the new bundle is ready for the next app launch.
 */
class OTADownloadWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val namespace = inputData.getString(KEY_NAMESPACE)
        if (namespace == null) {
            Log.e(TAG, "No namespace provided")
            return@withContext Result.failure()
        }

        Log.d(TAG, "Starting background OTA download for namespace: $namespace")

        try {
            val manager = managerMap[namespace]

            if (manager != null) {
                return@withContext downloadWithManager(manager)
            }

            // App was killed — ApplicationManager not initialized.
            // Retry up to MAX_RETRIES times, then give up.
            if (runAttemptCount >= MAX_RETRIES) {
                Log.w(TAG, "ApplicationManager not found for '$namespace' after $MAX_RETRIES attempts. Giving up.")
                return@withContext Result.failure()
            }
            Log.w(TAG, "ApplicationManager not found for '$namespace'. Will retry (attempt $runAttemptCount/$MAX_RETRIES).")
            return@withContext Result.retry()
        } catch (e: Exception) {
            Log.e(TAG, "Background download failed for '$namespace'", e)
            return@withContext Result.retry()
        }
    }

    private suspend fun downloadWithManager(manager: ApplicationManager): Result {
        // Quick version check to avoid heavier download when already up to date
        val checkResult = withContext(Dispatchers.IO) {
            manager.checkForUpdate()
        }

        val json = org.json.JSONObject(checkResult)
        if (!json.optBoolean("available", false)) {
            Log.d(TAG, "No update available, skipping download")
            return Result.success()
        }

        Log.d(TAG, "Update available: ${json.optString("currentVersion")} → ${json.optString("serverVersion")}")

        return suspendCoroutine { continuation ->
            manager.downloadUpdate { success ->
                if (success) {
                    Log.d(TAG, "Background download completed successfully")
                    continuation.resume(Result.success())
                } else {
                    Log.e(TAG, "Background download failed")
                    continuation.resume(Result.retry())
                }
            }
        }
    }

    companion object {
        private const val TAG = "OTADownloadWorker"
        private const val KEY_NAMESPACE = "namespace"
        private const val WORK_NAME_PREFIX = "ota_download_"
        private const val MAX_RETRIES = 5

        /** Registry of ApplicationManager instances by namespace, populated during init */
        val managerMap: MutableMap<String, ApplicationManager> = ConcurrentHashMap()

        /**
         * Enqueue a background OTA download job.
         * Uses KEEP policy so duplicate FCM messages are no-ops.
         */
        fun enqueue(context: Context, namespace: String) {
            val request = OneTimeWorkRequestBuilder<OTADownloadWorker>()
                .setInputData(workDataOf(KEY_NAMESPACE to namespace))
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    30,
                    TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork(
                    "$WORK_NAME_PREFIX$namespace",
                    ExistingWorkPolicy.KEEP,
                    request
                )

            Log.d(TAG, "Enqueued background download for '$namespace'")
        }
    }
}

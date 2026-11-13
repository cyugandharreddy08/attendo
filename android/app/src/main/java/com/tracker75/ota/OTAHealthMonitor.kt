package com.tracker75.ota

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.File

/**
 * Native Watchdog and Boot Health Monitor for Attendo OTA Updates.
 * Runs in native Android space to detect fatal startup crashes before or during JS initialization.
 * Automatically initiates self-healing rollback if repeated boot failures occur.
 */
object OTAHealthMonitor {

    private const val TAG = "OTAHealthMonitor"
    private const val MAX_BOOT_FAILURES = 2
    private const val STATE_FILE_NAME = "ota_state.json"

    fun getAppVersion(context: Context): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "8.0.2"
        } catch (e: Exception) {
            "8.0.2"
        }
    }

    data class OTAState(
        var status: String = "EMBEDDED", // EMBEDDED, PENDING, ACTIVE, CONFIRMED, ROLLED_BACK
        var activeVersion: String = "8.0.2",
        var pendingVersion: String? = null,
        var bootFailureCount: Int = 0,
        var lastRollbackReason: String? = null,
        var confirmedVersion: String = "8.0.2"
    )

    private fun getStateFile(context: Context): File {
        val otaDir = File(context.filesDir, "ota")
        if (!otaDir.exists()) otaDir.mkdirs()
        return File(otaDir, STATE_FILE_NAME)
    }

    @Synchronized
    fun readState(context: Context): OTAState {
        val file = getStateFile(context)
        val defaultVersion = getAppVersion(context)
        if (!file.exists()) return OTAState(activeVersion = defaultVersion, confirmedVersion = defaultVersion)

        return try {
            val json = JSONObject(file.readText())
            OTAState(
                status = json.optString("status", "EMBEDDED"),
                activeVersion = json.optString("active_version", defaultVersion),
                pendingVersion = if (json.has("pending_version") && !json.isNull("pending_version")) json.getString("pending_version") else null,
                bootFailureCount = json.optInt("boot_failure_count", 0),
                lastRollbackReason = if (json.has("last_rollback_reason") && !json.isNull("last_rollback_reason")) json.getString("last_rollback_reason") else null,
                confirmedVersion = json.optString("confirmed_version", defaultVersion)
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error reading OTA state, defaulting to safe embedded state: ${e.message}")
            OTAState(activeVersion = defaultVersion, confirmedVersion = defaultVersion)
        }
    }

    @Synchronized
    fun writeState(context: Context, state: OTAState) {
        val file = getStateFile(context)
        try {
            val json = JSONObject().apply {
                put("status", state.status)
                put("active_version", state.activeVersion)
                put("pending_version", state.pendingVersion)
                put("boot_failure_count", state.bootFailureCount)
                put("last_rollback_reason", state.lastRollbackReason)
                put("confirmed_version", state.confirmedVersion)
                put("updated_at", System.currentTimeMillis())
            }
            file.writeText(json.toString(2))
        } catch (e: Exception) {
            Log.e(TAG, "Error writing OTA state: ${e.message}")
        }
    }

    /**
     * Called in MainApplication.onCreate() on every application cold start.
     * Evaluates boot count and triggers self-healing rollback if ACTIVE bundle repeatedly crashes.
     */
    @Synchronized
    fun onAppLaunch(context: Context) {
        val state = readState(context)

        when (state.status) {
            "PENDING" -> {
                Log.i(TAG, "Promoting PENDING bundle (v${state.pendingVersion}) to ACTIVE...")
                val promoted = OTABundleManager.promotePendingToActive(context)
                if (promoted) {
                    state.status = "ACTIVE"
                    state.activeVersion = state.pendingVersion ?: state.activeVersion
                    state.pendingVersion = null
                    state.bootFailureCount = 1 // Start failure tracker for the newly promoted active bundle
                    writeState(context, state)
                } else {
                    Log.e(TAG, "Failed to promote pending bundle. Reverting to EMBEDDED.")
                    state.status = "EMBEDDED"
                    state.pendingVersion = null
                    writeState(context, state)
                }
            }
            "ACTIVE" -> {
                state.bootFailureCount += 1
                Log.w(TAG, "Active bundle boot attempt count: ${state.bootFailureCount} / $MAX_BOOT_FAILURES")

                if (state.bootFailureCount > MAX_BOOT_FAILURES) {
                    Log.e(TAG, "Active bundle exceeded max crash threshold! Triggering automatic rollback...")
                    val rolledBack = OTABundleManager.rollback(context)
                    state.status = if (rolledBack) "ROLLED_BACK" else "EMBEDDED"
                    state.lastRollbackReason = "Exceeded $MAX_BOOT_FAILURES startup boot attempts without confirmation"
                    state.bootFailureCount = 0
                    writeState(context, state)
                } else {
                    writeState(context, state)
                }
            }
            "CONFIRMED" -> {
                // Happy path: Healthy verified bundle
                state.bootFailureCount = 0
                writeState(context, state)
            }
            else -> {
                // EMBEDDED or ROLLED_BACK
            }
        }
    }

    /**
     * Called from JS once React Native has successfully mounted its root view and rendered UI.
     * Transitions ACTIVE -> CONFIRMED and resets boot failures.
     */
    @Synchronized
    fun confirmBoot(context: Context): Boolean {
        val state = readState(context)
        if (state.status == "ACTIVE" || state.status == "EMBEDDED") {
            state.status = "CONFIRMED"
            state.bootFailureCount = 0
            state.confirmedVersion = state.activeVersion
            writeState(context, state)
            Log.i(TAG, "Bundle v${state.activeVersion} confirmed healthy by JavaScript runtime.")
            return true
        }
        return false
    }
}

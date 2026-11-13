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

    data class OTAState(
        var status: String = "EMBEDDED", // EMBEDDED, PENDING, ACTIVE, CONFIRMED, ROLLED_BACK
        var activeVersion: String = "8.0.0",
        var pendingVersion: String? = null,
        var bootFailureCount: Int = 0,
        var lastRollbackReason: String? = null,
        var confirmedVersion: String = "8.0.0"
    )

    private fun getStateFile(context: Context): File {
        val otaDir = File(context.filesDir, "ota")
        if (!otaDir.exists()) otaDir.mkdirs()
        return File(otaDir, STATE_FILE_NAME)
    }

    @Synchronized
    fun readState(context: Context): OTAState {
        val file = getStateFile(context)
        if (!file.exists()) return OTAState()

        return try {
            val json = JSONObject(file.readText())
            OTAState(
                status = json.optString("status", "EMBEDDED"),
                activeVersion = json.optString("active_version", "8.0.0"),
                pendingVersion = if (json.has("pending_version") && !json.isNull("pending_version")) json.getString("pending_version") else null,
                bootFailureCount = json.optInt("boot_failure_count", 0),
                lastRollbackReason = if (json.has("last_rollback_reason") && !json.isNull("last_rollback_reason")) json.getString("last_rollback_reason") else null,
                confirmedVersion = json.optString("confirmed_version", "8.0.0")
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error reading OTA state, defaulting to safe embedded state: ${e.message}")
            OTAState()
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

        // 1. Check if there is a verified PENDING bundle awaiting activation on this launch
        if (state.status == "PENDING" && state.pendingVersion != null) {
            Log.i(TAG, "Activating pending OTA bundle: ${state.pendingVersion}")
            val promoted = OTABundleManager.promotePendingToActive(context)
            if (promoted) {
                state.status = "ACTIVE"
                state.activeVersion = state.pendingVersion!!
                state.pendingVersion = null
                state.bootFailureCount = 1
                writeState(context, state)
                return
            } else {
                Log.e(TAG, "Failed to promote pending bundle to active; remaining on current bundle.")
                state.status = "CONFIRMED"
                state.pendingVersion = null
                writeState(context, state)
                return
            }
        }

        // 2. If status is ACTIVE (currently testing newly booted bundle)
        if (state.status == "ACTIVE") {
            if (state.bootFailureCount >= MAX_BOOT_FAILURES) {
                Log.w(TAG, "⚠️ Bundle ${state.activeVersion} failed to boot ${state.bootFailureCount} times. Triggering AUTOMATIC ROLLBACK!")
                OTABundleManager.rollback(context)
                state.status = "ROLLED_BACK"
                state.lastRollbackReason = "Crash loop detected on startup (${state.bootFailureCount} failed attempts)"
                state.activeVersion = state.confirmedVersion
                state.bootFailureCount = 0
                writeState(context, state)
            } else {
                state.bootFailureCount += 1
                Log.i(TAG, "Booting unconfirmed active bundle ${state.activeVersion} (Attempt #${state.bootFailureCount})")
                writeState(context, state)
            }
        }
    }

    /**
     * Called from JavaScript once the React component tree mounts and passes initial health checks.
     * Marks the active bundle as CONFIRMED.
     */
    @Synchronized
    fun confirmBoot(context: Context): Boolean {
        val state = readState(context)
        Log.i(TAG, "🎉 Boot successfully confirmed by JavaScript for version ${state.activeVersion}!")
        state.status = "CONFIRMED"
        state.confirmedVersion = state.activeVersion
        state.bootFailureCount = 0
        state.lastRollbackReason = null
        writeState(context, state)
        return true
    }
}

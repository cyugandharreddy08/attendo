package com.tracker75.ota

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.zip.ZipInputStream

/**
 * Enterprise Directory & Storage Manager for Attendo Dynamic Bundles.
 * Enforces atomic directory rotation between pending, active, and previous bundles.
 */
object OTABundleManager {

    private const val TAG = "OTABundleManager"
    const val BUNDLE_FILE_NAME = "index.android.bundle"

    fun getOtaRoot(context: Context): File {
        val root = File(context.filesDir, "ota")
        if (!root.exists()) root.mkdirs()
        return root
    }

    fun getPendingDir(context: Context): File = File(getOtaRoot(context), "pending")
    fun getActiveDir(context: Context): File = File(getOtaRoot(context), "active")
    fun getPreviousDir(context: Context): File = File(getOtaRoot(context), "previous")
    fun getStagingDir(context: Context): File = File(getOtaRoot(context), "staging")

    /**
     * Extracts an archive containing `index.android.bundle` and optional assets to the staging directory.
     * Prevents path traversal vulnerabilities (Zip Slip).
     */
    fun extractArchive(zipFile: File, destinationDir: File): Boolean {
        if (!destinationDir.exists()) destinationDir.mkdirs()

        return try {
            ZipInputStream(FileInputStream(zipFile)).use { zis ->
                var entry = zis.nextEntry
                val destCanonicalPath = destinationDir.canonicalPath

                while (entry != null) {
                    val newFile = File(destinationDir, entry.name)
                    // Security: Guard against Zip Slip path traversal
                    if (!newFile.canonicalPath.startsWith(destCanonicalPath)) {
                        throw SecurityException("Zip entry is outside of target dir: ${entry.name}")
                    }

                    if (entry.isDirectory) {
                        newFile.mkdirs()
                    } else {
                        newFile.parentFile?.mkdirs()
                        FileOutputStream(newFile).use { fos ->
                            val buffer = ByteArray(8192)
                            var len: Int
                            while (zis.read(buffer).also { len = it } > 0) {
                                fos.write(buffer, 0, len)
                            }
                        }
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error extracting bundle archive: ${e.message}")
            false
        }
    }

    /**
     * Atomically promotes the pending directory to active, moving previous active to previous.
     */
    @Synchronized
    fun promotePendingToActive(context: Context): Boolean {
        val pending = getPendingDir(context)
        val active = getActiveDir(context)
        val previous = getPreviousDir(context)

        val bundleInPending = File(pending, BUNDLE_FILE_NAME)
        if (!bundleInPending.exists() || bundleInPending.length() < 1000) {
            Log.e(TAG, "Cannot promote: pending directory missing valid $BUNDLE_FILE_NAME")
            return false
        }

        try {
            // 1. Clear previous
            if (previous.exists()) previous.deleteRecursively()

            // 2. Move active -> previous (if active exists)
            if (active.exists()) {
                active.renameTo(previous)
            }

            // 3. Move pending -> active
            val success = pending.renameTo(active)
            if (!success) {
                // If direct rename fails, copy and delete
                pending.copyRecursively(active, overwrite = true)
                pending.deleteRecursively()
            }

            Log.i(TAG, "Successfully promoted pending bundle to active!")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to promote pending bundle to active: ${e.message}")
            return false
        }
    }

    /**
     * Rolls back from active to previous working directory.
     */
    @Synchronized
    fun rollback(context: Context): Boolean {
        val active = getActiveDir(context)
        val previous = getPreviousDir(context)

        try {
            if (active.exists()) {
                active.deleteRecursively()
            }

            if (previous.exists() && File(previous, BUNDLE_FILE_NAME).exists()) {
                previous.renameTo(active)
                Log.i(TAG, "Rolled back active directory to previous confirmed bundle.")
                return true
            }

            Log.i(TAG, "No previous bundle found; rolled back to embedded factory APK bundle.")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Rollback failed: ${e.message}")
            return false
        }
    }

    /**
     * Resolves the bundle file to supply to ReactNativeHost.getJSBundleFile().
     * Returns null if no healthy custom bundle exists, which tells React Native to load embedded assets.
     */
    fun getLaunchBundlePath(context: Context): String? {
        val state = OTAHealthMonitor.readState(context)
        if (state.status == "ROLLED_BACK") {
            Log.i(TAG, "System in ROLLED_BACK state, falling back to embedded asset bundle.")
            return null
        }

        val active = getActiveDir(context)
        val bundleFile = File(active, BUNDLE_FILE_NAME)
        if (bundleFile.exists() && bundleFile.isFile && bundleFile.length() > 1000) {
            Log.i(TAG, "Loading dynamic OTA bundle: ${bundleFile.absolutePath} (version: ${state.activeVersion})")
            return bundleFile.absolutePath
        }

        Log.i(TAG, "No active custom bundle found; loading embedded assets bundle.")
        return null
    }
}

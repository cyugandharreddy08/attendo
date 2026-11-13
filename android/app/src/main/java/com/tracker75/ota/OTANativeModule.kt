package com.tracker75.ota

import android.app.Activity
import android.content.Intent
import android.os.Process
import com.facebook.react.bridge.*
import java.io.File

class OTANativeModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OTANativeModule"

    @ReactMethod
    fun confirmBoot(promise: Promise) {
        try {
            val confirmed = OTAHealthMonitor.confirmBoot(reactContext)
            promise.resolve(confirmed)
        } catch (e: Exception) {
            promise.reject("CONFIRM_BOOT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getOTAStatus(promise: Promise) {
        try {
            val state = OTAHealthMonitor.readState(reactContext)
            val map = Arguments.createMap().apply {
                putString("status", state.status)
                putString("activeVersion", state.activeVersion)
                putString("pendingVersion", state.pendingVersion)
                putInt("bootFailureCount", state.bootFailureCount)
                putString("confirmedVersion", state.confirmedVersion)
                putString("lastRollbackReason", state.lastRollbackReason)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stageUpdate(
        archivePath: String,
        expectedSha256: String,
        signatureBase64: String,
        targetVersion: String,
        promise: Promise
    ) {
        Thread {
            try {
                val cleanPath = archivePath.replace("file://", "")
                val archiveFile = File(cleanPath)

                if (!archiveFile.exists() || !archiveFile.isFile) {
                    promise.reject("FILE_NOT_FOUND", "Download package does not exist at $cleanPath")
                    return@Thread
                }

                // 1. Verify SHA-256 Digest
                val checksumValid = OTASignatureVerifier.verifyChecksum(archiveFile, expectedSha256)
                if (!checksumValid) {
                    val computed = OTASignatureVerifier.computeSHA256(archiveFile)
                    archiveFile.delete()
                    promise.reject("CHECKSUM_MISMATCH", "SHA-256 integrity check failed. Expected: $expectedSha256, Computed: $computed")
                    return@Thread
                }

                // 2. Verify Digital Signature with Embedded RSA Public Key
                val signatureValid = OTASignatureVerifier.verifySignature(archiveFile, signatureBase64)
                if (!signatureValid) {
                    archiveFile.delete()
                    promise.reject("INVALID_SIGNATURE", "Cryptographic signature verification failed. The update package cannot be authenticated.")
                    return@Thread
                }

                // 3. Extract to Staging
                val stagingDir = OTABundleManager.getStagingDir(reactContext)
                if (stagingDir.exists()) stagingDir.deleteRecursively()
                stagingDir.mkdirs()

                // Check if file is zip or raw bundle
                val bundleFile: File
                if (cleanPath.endsWith(".zip", ignoreCase = true)) {
                    val extracted = OTABundleManager.extractArchive(archiveFile, stagingDir)
                    if (!extracted) {
                        stagingDir.deleteRecursively()
                        archiveFile.delete()
                        promise.reject("EXTRACTION_ERROR", "Failed to extract bundle archive.")
                        return@Thread
                    }
                    bundleFile = File(stagingDir, OTABundleManager.BUNDLE_FILE_NAME)
                } else {
                    // Direct .bundle file
                    bundleFile = File(stagingDir, OTABundleManager.BUNDLE_FILE_NAME)
                    archiveFile.copyTo(bundleFile, overwrite = true)
                }

                if (!bundleFile.exists() || bundleFile.length() < 1000) {
                    stagingDir.deleteRecursively()
                    archiveFile.delete()
                    promise.reject("CORRUPT_BUNDLE", "Extracted package does not contain a valid index.android.bundle.")
                    return@Thread
                }

                // Clean up archive
                archiveFile.delete()

                // 4. Move Staging to Pending
                val pendingDir = OTABundleManager.getPendingDir(reactContext)
                if (pendingDir.exists()) pendingDir.deleteRecursively()
                val moved = stagingDir.renameTo(pendingDir)
                if (!moved) {
                    stagingDir.copyRecursively(pendingDir, overwrite = true)
                    stagingDir.deleteRecursively()
                }

                // 5. Update State
                val state = OTAHealthMonitor.readState(reactContext)
                state.status = "PENDING"
                state.pendingVersion = targetVersion
                OTAHealthMonitor.writeState(reactContext, state)

                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("pendingVersion", targetVersion)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("STAGE_UPDATE_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun restartApp() {
        val currentActivity = currentActivity ?: reactContext.currentActivity
        val context = currentActivity ?: reactContext

        val packageManager = context.packageManager
        val intent = packageManager.getLaunchIntentForPackage(context.packageName)
        val componentName = intent?.component
        val restartIntent = Intent.makeRestartActivityTask(componentName)

        context.startActivity(restartIntent)
        Process.killProcess(Process.myPid())
    }
}

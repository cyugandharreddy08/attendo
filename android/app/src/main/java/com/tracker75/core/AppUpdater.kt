package com.tracker75.core

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

object AppUpdater {
    suspend fun downloadAndInstall(
        context: Context,
        apkUrl: String,
        patchUrl: String? = null,
        onProgress: (Int) -> Unit
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
            val outApkFile = File(updatesDir, "attendo-update.apk")
            if (outApkFile.exists()) outApkFile.delete()

            var patchedOk = false
            if (!patchUrl.isNullOrBlank()) {
                val patchFile = File(updatesDir, "update.qbs")
                if (patchFile.exists()) patchFile.delete()

                val dlPatch = downloadFile(patchUrl, patchFile, onProgress)
                if (dlPatch.isSuccess) {
                    val baseApkPath = context.applicationInfo.sourceDir
                    val patchRes = AttendoCore.invoke(
                        "apply_apk_patch",
                        JSONObject()
                            .put("old_apk_path", baseApkPath)
                            .put("patch_path", patchFile.absolutePath)
                            .put("out_apk_path", outApkFile.absolutePath)
                    )
                    patchFile.delete()
                    if (patchRes.isSuccess && outApkFile.exists() && outApkFile.length() > 1_000_000L) {
                        patchedOk = true
                    } else if (outApkFile.exists()) {
                        outApkFile.delete()
                    }
                }
            }

            if (!patchedOk) {
                val dlApk = downloadFile(apkUrl, outApkFile, onProgress)
                if (dlApk.isFailure) {
                    return@withContext Result.failure(dlApk.exceptionOrNull() ?: Exception("Download failed"))
                }
            }

            withContext(Dispatchers.Main) {
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    outApkFile
                )
                val installIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(installIntent)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun downloadFile(
        urlStr: String,
        dest: File,
        onProgress: (Int) -> Unit
    ): Result<Unit> {
        return try {
            val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = true
                connectTimeout = 15000
                readTimeout = 30000
                setRequestProperty("User-Agent", "Attendo-Delta-Updater/9.2.1")
            }
            conn.connect()
            if (conn.responseCode !in 200..299) {
                return Result.failure(Exception("HTTP ${conn.responseCode}"))
            }

            val totalBytes = conn.contentLengthLong.coerceAtLeast(1L)
            var downloaded = 0L
            conn.inputStream.use { input ->
                FileOutputStream(dest).use { output ->
                    val buf = ByteArray(16 * 1024)
                    var read: Int
                    while (input.read(buf).also { read = it } != -1) {
                        output.write(buf, 0, read)
                        downloaded += read
                        val pct = ((downloaded * 100L) / totalBytes).toInt().coerceIn(0, 100)
                        onProgress(pct)
                    }
                }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

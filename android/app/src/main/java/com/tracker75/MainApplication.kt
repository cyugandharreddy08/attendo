package com.tracker75

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.tracker75.core.AttendoCore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        val dbFile = getDatabasePath("tracker75.db")
        dbFile.parentFile?.mkdirs()
        AttendoCore.init(dbFile.absolutePath)

        // Extract and initialize on-device Needle 3 (33.7 MB) in background
        CoroutineScope(Dispatchers.IO).launch {
            try {
                System.loadLibrary("cactus_engine")
            } catch (_: UnsatisfiedLinkError) {
                // Non-arm64 fallback handled gracefully
            }
            try {
                val modelFile = File(filesDir, "needle3.cact")
                if (!modelFile.exists() || modelFile.length() < 1_000_000L) {
                    assets.open("needle3.cact").use { input ->
                        FileOutputStream(modelFile).use { output ->
                            input.copyTo(output, 64 * 1024)
                        }
                    }
                }
                AttendoCore.invoke("init_needle", JSONObject().put("model_path", modelFile.absolutePath))
            } catch (_: Exception) {
                // Graceful fallback to deterministic parser / cloud AI
            }
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(NotificationManager::class.java)
            val classChannel = NotificationChannel(
                "attendo_classes",
                "Class Reminders & Nudges",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Pre-class alerts and end-of-day attendance nudges"
            }
            val todoChannel = NotificationChannel(
                "attendo_todos",
                "Task & Assignment Alarms",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Reminders for upcoming tasks and submissions"
            }
            mgr.createNotificationChannel(classChannel)
            mgr.createNotificationChannel(todoChannel)
        }
    }
}

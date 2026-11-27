package com.tracker75

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.tracker75.core.AttendoCore

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        val dbFile = getDatabasePath("tracker75.db")
        dbFile.parentFile?.mkdirs()
        AttendoCore.init(dbFile.absolutePath)
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

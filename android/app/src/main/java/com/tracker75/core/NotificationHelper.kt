package com.tracker75.core

import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.tracker75.R
import java.util.concurrent.TimeUnit

class DailyNudgeWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : Worker(appContext, workerParams) {
    override fun doWork(): Result {
        val mgr = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notif = NotificationCompat.Builder(applicationContext, "attendo_classes")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Attendo 75% Shield")
            .setContentText("Don't forget to mark today's attendance & protect your streak!")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        mgr.notify(7501, notif)
        return Result.success()
    }
}

object NotificationHelper {
    fun scheduleDailyNudge(context: Context) {
        val request = PeriodicWorkRequestBuilder<DailyNudgeWorker>(24, TimeUnit.HOURS)
            .setInitialDelay(8, TimeUnit.HOURS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "attendo_daily_nudge",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }
}

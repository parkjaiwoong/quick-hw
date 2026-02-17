package com.quickhw.driver_app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        createDeliveryNotificationChannel()
    }

    /** FCM 백그라운드 알림 소리/진동용 채널 (push/send의 channelId: delivery_request 와 동일) */
    private fun createDeliveryNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "delivery_request",
            "배송 요청 알림",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "새 배송 요청이 올 때 소리와 진동"
            setSound(Settings.System.DEFAULT_NOTIFICATION_URI, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 200, 100, 200)
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        manager?.createNotificationChannel(channel)
    }
}

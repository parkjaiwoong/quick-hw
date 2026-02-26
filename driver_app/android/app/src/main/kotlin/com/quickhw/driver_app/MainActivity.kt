package com.quickhw.driver_app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    companion object {
        const val EXTRA_ACCEPT_DELIVERY_ID = "accept_delivery_id"
        /** 오버레이/배차 수락 후 WebView에 로드할 경로 (예: /driver?accept_delivery=123 또는 /order/123) */
        const val EXTRA_OPEN_URL = "open_url"
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        createDeliveryNotificationChannel()
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getLaunchAcceptDeliveryId" -> {
                    val id = intent?.getStringExtra(EXTRA_ACCEPT_DELIVERY_ID)
                    intent?.removeExtra(EXTRA_ACCEPT_DELIVERY_ID)
                    result.success(id)
                }
                "getLaunchOpenUrl" -> {
                    val path = intent?.getStringExtra(EXTRA_OPEN_URL)
                    intent?.removeExtra(EXTRA_OPEN_URL)
                    result.success(path)
                }
                "getOverlayPermissionGranted" -> {
                    result.success(
                        Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                        Settings.canDrawOverlays(this)
                    )
                }
                "openOverlayPermissionSettings" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        val i = Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:$packageName")
                        )
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(i)
                    }
                    result.success(null)
                }
                "showDispatchOverlay" -> {
                    @Suppress("UNCHECKED_CAST")
                    val args = call.arguments as? Map<String, Any?> ?: emptyMap()
                    val deliveryId = (args["delivery_id"] ?: args["deliveryId"])?.toString() ?: ""
                    val origin = (args["pickup"] ?: args["origin_address"] ?: args["origin"])?.toString() ?: "-"
                    val dest = (args["destination"] ?: args["destination_address"] ?: args["dest"])?.toString() ?: "-"
                    val fee = (args["price"] ?: args["fee"])?.toString() ?: "-"
                    val intent = Intent(this, DispatchOverlayActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NO_USER_ACTION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                        putExtra(DispatchOverlayActivity.EXTRA_DELIVERY_ID, deliveryId)
                        putExtra(DispatchOverlayActivity.EXTRA_ORIGIN, origin)
                        putExtra(DispatchOverlayActivity.EXTRA_DEST, dest)
                        putExtra(DispatchOverlayActivity.EXTRA_FEE, fee)
                    }
                    startActivity(intent)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    private val CHANNEL = "com.quickhw.driver_app/launch"

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

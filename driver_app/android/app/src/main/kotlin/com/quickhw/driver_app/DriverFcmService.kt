package com.quickhw.driver_app

import android.app.ActivityManager
import android.app.ActivityOptions
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.RemoteMessage
import io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingService
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * FCM 수신 시 새 배송 요청이면:
 * - 앱이 포그라운드 상태 → Flutter _onForegroundMessage가 처리하므로 네이티브에서 스킵.
 * - 앱이 백그라운드/종료 상태 → 항상 Full Screen Intent로 Activity 실행.
 *   (Android 10+ 백그라운드에서 startActivity 직접 호출 시 조용히 실패하므로 Full Screen Intent 필수)
 *   - 오버레이 권한 있음 → DispatchOverlayActivity(Flutter overlayMain) 표시.
 *   - 오버레이 권한 없음 → DispatchAcceptActivity(Kotlin 기본 UI) 표시.
 *
 * 중요: notification 필드 없이 data 필드만 보내야 백그라운드/앱 종료 시에도 onMessageReceived가 호출됨.
 */
class DriverFcmService : FlutterFirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.i(TAG, "========== FCM onMessageReceived 진입 ==========")
        val data = remoteMessage.data ?: emptyMap()
        logFcmReceiptToDb(data, "native")
        Log.i(TAG, "전체 수신 데이터: $data")
        val type = data["type"] ?: ""
        val deliveryId = data["delivery_id"] ?: data["deliveryId"]
            ?: data["order_id"] ?: data["orderId"] ?: data["order_number"] ?: ""
        val isDeliveryType = type == "new_delivery_request" || type == "new_delivery"
        val hasDeliveryKey = deliveryId.isNotEmpty()
        if (!isDeliveryType && !hasDeliveryKey) {
            Log.i(TAG, "skip (not dispatch) type=$type deliveryId=$deliveryId")
            super.onMessageReceived(remoteMessage)
            return
        }

        // 앱이 포그라운드 상태면 Flutter _onForegroundMessage가 이미 처리 → 네이티브 중복 실행 방지
        if (isAppInForeground()) {
            Log.i(TAG, "Dispatch FCM: app is FOREGROUND — skipping native overlay (Flutter handles it)")
            super.onMessageReceived(remoteMessage)
            return
        }

        // data만 있어도 동작 (notification 불필요)
        // Android 10+ 백그라운드에서 startActivity 직접 호출 시 조용히 실패함.
        // 반드시 Full Screen Intent로 Activity 실행해야 함.
        Log.i(TAG, "Dispatch FCM: app is BACKGROUND/KILLED — using Full Screen Intent")
        val pickup = data["pickup"] ?: data["origin_address"] ?: data["origin"] ?: "-"
        val destination = data["destination"] ?: data["destination_address"] ?: data["dest"] ?: "-"
        val price = data["price"] ?: data["fee"] ?: "-"
        val title = remoteMessage.notification?.title ?: "신규 배차 요청"
        val body = remoteMessage.notification?.body ?: "배송 요청이 도착했습니다."
        val overlayPermitted = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)
        createFullScreenIntentNotification(
            title = title,
            body = body,
            deliveryId = deliveryId,
            origin = pickup,
            dest = destination,
            fee = price,
            useFlutterOverlay = overlayPermitted
        )
        super.onMessageReceived(remoteMessage)
    }

    /** 앱(패키지)이 현재 포그라운드(화면에 보임)인지 확인. 불확실하면 false(백그라운드로 처리) */
    private fun isAppInForeground(): Boolean {
        return try {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return false
            val tasks = am.getRunningTasks(1)
            if (tasks.isNullOrEmpty()) false
            else {
                val top = tasks[0].topActivity ?: return false
                top.packageName == packageName
            }
        } catch (_: Exception) {
            false
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM onNewToken: ${token.take(50)}...")
    }

    private fun createFullScreenIntentNotification(
        title: String,
        body: String,
        deliveryId: String,
        origin: String,
        dest: String,
        fee: String,
        useFlutterOverlay: Boolean
    ) {
        val channelId = "delivery_dispatch_full"
        createChannel(channelId)
        val fullScreenIntent = if (useFlutterOverlay) {
            Intent(this, DispatchOverlayActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_NO_USER_ACTION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                putExtra(DispatchOverlayActivity.EXTRA_DELIVERY_ID, deliveryId)
                putExtra(DispatchOverlayActivity.EXTRA_ORIGIN, origin)
                putExtra(DispatchOverlayActivity.EXTRA_DEST, dest)
                putExtra(DispatchOverlayActivity.EXTRA_FEE, fee)
            }
        } else {
            Intent(this, DispatchAcceptActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_NO_USER_ACTION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                putExtra(DispatchAcceptActivity.EXTRA_DELIVERY_ID, deliveryId)
                putExtra(DispatchAcceptActivity.EXTRA_TITLE, title)
                putExtra(DispatchAcceptActivity.EXTRA_BODY, body)
            }
        }
        // Android 14+: 백그라운드에서 PendingIntent 실행 허용
        val options = if (Build.VERSION.SDK_INT >= 34) {
            ActivityOptions.makeBasic().setPendingIntentCreatorBackgroundActivityStartMode(
                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
            ).toBundle()
        } else {
            null
        }
        val fullScreenPendingIntent = android.app.PendingIntent.getActivity(
            this,
            deliveryId.hashCode(),
            fullScreenIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
            options
        )
        val contentPendingIntent = android.app.PendingIntent.getActivity(
            this,
            deliveryId.hashCode() + 1,
            fullScreenIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
            options
        )
        // 화면 꺼진 상태에서 Full Screen Intent 표시를 위해 WakeLock 사용
        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = pm?.newWakeLock(
            PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE or PowerManager.SCREEN_BRIGHT_WAKE_LOCK,
            "DriverFcmService:FullScreen"
        )
        wakeLock?.acquire(10_000L)
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(contentPendingIntent)
            .setAutoCancel(true)
            .setTimeoutAfter(60_000)
            .build()
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification)
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            try { wakeLock?.release() } catch (_: Exception) {}
        }, 3000)
    }

    private fun createChannel(channelId: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            channelId,
            "배차 수락",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "새 배송 요청 시 전체화면/오버레이"
            setSound(Settings.System.DEFAULT_NOTIFICATION_URI,
                android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION).build())
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 200, 100, 200)
            setBypassDnd(true)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    private fun logFcmReceiptToDb(data: Map<String, String>, source: String) {
        val driverId = data["driver_id"] ?: data["driverId"] ?: ""
        if (driverId.isEmpty()) {
            Log.w(TAG, "FCM 로그 중단: driver_id가 FCM data에 없습니다. push/send API에서 driver_id(user_id) 포함 여부 확인. 수신 data=$data")
            return
        }

        Thread {
            try {
                val targetUrl = "$API_BASE_URL/api/driver/fcm-receipt-log"
                Log.d(TAG, "FCM 로그 시도 (source=$source, driverId=$driverId, url=$targetUrl)")

                val url = URL(targetUrl)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Accept", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 10000
                conn.readTimeout = 10000

                val deliveryId = data["delivery_id"] ?: data["deliveryId"] ?: ""
                val body = JSONObject().apply {
                    put("driver_id", driverId)
                    put("delivery_id", deliveryId)
                    put("source", source)
                    put("raw_data", JSONObject(data as Map<*, *>))
                }

                OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }

                val code = conn.responseCode
                val responseMessage = conn.responseMessage
                val responseBody = if (code in 200..299) {
                    conn.inputStream?.bufferedReader()?.use { it.readText() } ?: ""
                } else {
                    conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                }

                if (code in 200..299) {
                    Log.i(TAG, "FCM 수신 DB 로그 저장 완료 (driver=$driverId, delivery=$deliveryId, source=$source, code=$code)")
                } else {
                    Log.w(TAG, "FCM 수신 DB 로그 실패: HTTP $code $responseMessage | body=$responseBody")
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "FCM 수신 DB 로그 네트워크 오류: ${e.message}", e)
            }
        }.start()
    }

    companion object {
        private const val TAG = "DriverFcmService"
        private const val NOTIFICATION_ID = 9001
        // 로컬 테스트 시 10.0.2.2(에뮬레이터) 또는 루프백 등을 사용할 수 있도록 유연하게 처리
        private const val API_BASE_URL = "https://quick-hw.vercel.app"
    }
}

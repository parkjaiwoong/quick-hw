package com.quickhw.driver_app

import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
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
 * - 앱이 백그라운드/종료 상태:
 *   - 오버레이 권한 있음 → DispatchOverlayActivity(Flutter overlayMain) 시작.
 *   - 오버레이 권한 없음 → Full Screen Intent로 DispatchAcceptActivity(Kotlin) 표시.
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
        Log.i(TAG, "Dispatch FCM: app is BACKGROUND/KILLED — type=$type delivery_id=$deliveryId")
        val pickup = data["pickup"] ?: data["origin_address"] ?: data["origin"] ?: "-"
        val destination = data["destination"] ?: data["destination_address"] ?: data["dest"] ?: "-"
        val price = data["price"] ?: data["fee"] ?: "-"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
            Log.i(TAG, "Dispatch FCM: starting DispatchOverlayActivity (overlay permitted)")
            startDispatchOverlayActivity(deliveryId, pickup, destination, price)
        } else {
            Log.i(TAG, "Dispatch FCM: showing FullScreenIntent (overlay not permitted)")
            createFullScreenIntentNotification(
                title = remoteMessage.notification?.title ?: "신규 배차 요청",
                body = remoteMessage.notification?.body ?: "배송 요청이 도착했습니다.",
                deliveryId = deliveryId
            )
        }
        super.onMessageReceived(remoteMessage)
    }

    /** 앱(패키지)이 현재 포그라운드(화면에 보임)인지 확인 */
    private fun isAppInForeground(): Boolean {
        val am = getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return false
        val tasks = am.getRunningTasks(1)
        if (tasks.isNullOrEmpty()) return false
        val topActivity = tasks[0].topActivity ?: return false
        return topActivity.packageName == packageName
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM onNewToken: ${token.take(50)}...")
    }

    private fun startDispatchOverlayActivity(deliveryId: String, origin: String, dest: String, fee: String) {
        val intent = Intent(this, DispatchOverlayActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NO_USER_ACTION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
            putExtra(DispatchOverlayActivity.EXTRA_DELIVERY_ID, deliveryId)
            putExtra(DispatchOverlayActivity.EXTRA_ORIGIN, origin)
            putExtra(DispatchOverlayActivity.EXTRA_DEST, dest)
            putExtra(DispatchOverlayActivity.EXTRA_FEE, fee)
        }
        startActivity(intent)
    }

    private fun createFullScreenIntentNotification(
        title: String,
        body: String,
        deliveryId: String
    ) {
        val channelId = "delivery_dispatch_full"
        createChannel(channelId)
        val fullScreenIntent = Intent(this, DispatchAcceptActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_NO_USER_ACTION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
            putExtra(DispatchAcceptActivity.EXTRA_DELIVERY_ID, deliveryId)
            putExtra(DispatchAcceptActivity.EXTRA_TITLE, title)
            putExtra(DispatchAcceptActivity.EXTRA_BODY, body)
        }
        val fullScreenPendingIntent = android.app.PendingIntent.getActivity(
            this,
            deliveryId.hashCode(),
            fullScreenIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setAutoCancel(true)
            .setTimeoutAfter(60_000)
            .build()
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification)
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
        val driverId = data["driver_id"] ?: data["driverId"] ?: return
        Thread {
            try {
                val url = URL("$API_BASE_URL/api/driver/fcm-receipt-log")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                val body = JSONObject().apply {
                    put("driver_id", driverId)
                    put("delivery_id", data["delivery_id"] ?: data["deliveryId"] ?: "")
                    put("source", source)
                    put("raw_data", JSONObject(data))
                }
                OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }
                val code = conn.responseCode
                if (code in 200..299) Log.i(TAG, "FCM 수신 DB 로그 저장 완료")
                else Log.w(TAG, "FCM 수신 DB 로그 실패: $code")
            } catch (e: Exception) {
                Log.w(TAG, "FCM 수신 DB 로그 오류: ${e.message}")
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

package com.quickhw.driver_app

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

/**
 * FCM 수신 시 새 배송 요청이면:
 * - 오버레이 권한이 있으면 → DispatchOverlayActivity(Flutter overlayMain) 시작. (WindowManager로 뷰 직접 추가하지 않음.)
 * - 없으면 → Full Screen Intent로 DispatchAcceptActivity(Kotlin) 표시.
 * 수락 시 MainActivity를 띄우고 open_url(또는 accept_delivery_id) 전달 → Flutter WebView가 해당 URL 로드.
 *
 * 중요: notification 필드 없이 data 필드만 보내야 백그라운드/앱 종료 시에도 onMessageReceived가 호출됨.
 */
class DriverFcmService : FlutterFirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.i(TAG, "========== FCM onMessageReceived 진입 ==========")
        val data = remoteMessage.data ?: emptyMap()
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
        // data만 있어도 동작 (notification 불필요)
        Log.i(TAG, "Dispatch FCM: type=$type delivery_id=$deliveryId")
        val origin = data["origin_address"] ?: data["origin"] ?: "-"
        val dest = data["destination_address"] ?: data["destination"] ?: "-"
        val fee = data["fee"] ?: data["price"] ?: "-"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
            Log.i(TAG, "Dispatch FCM: starting DispatchOverlayActivity (overlay permitted)")
            startDispatchOverlayActivity(deliveryId, origin, dest, fee)
        } else {
            Log.i(TAG, "Dispatch FCM: showing FullScreenIntent (overlay not permitted)")
            // data만 보낸 경우 notification이 null이므로 기본 문구 사용
            createFullScreenIntentNotification(
                title = remoteMessage.notification?.title ?: "신규 배차 요청",
                body = remoteMessage.notification?.body ?: "배송 요청이 도착했습니다.",
                deliveryId = deliveryId
            )
        }
        super.onMessageReceived(remoteMessage)
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

    companion object {
        private const val TAG = "DriverFcmService"
        private const val NOTIFICATION_ID = 9001
    }
}

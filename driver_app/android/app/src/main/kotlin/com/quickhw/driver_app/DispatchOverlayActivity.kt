package com.quickhw.driver_app

import android.content.Intent
import android.os.Build
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Flutter 위젯 방식 배차 수락 오버레이.
 * overlayMain 엔트리 포인트로 실행되며, getPayload / accept / dismiss MethodChannel로 Dart와 통신.
 */
class DispatchOverlayActivity : FlutterActivity() {

    override fun getDartEntrypointFunctionName(): String = "overlayMain"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getPayload" -> {
                    val origin = intent?.getStringExtra(EXTRA_ORIGIN) ?: "-"
                    val dest = intent?.getStringExtra(EXTRA_DEST) ?: "-"
                    val fee = intent?.getStringExtra(EXTRA_FEE) ?: "-"
                    val map = mapOf(
                        "delivery_id" to (intent?.getStringExtra(EXTRA_DELIVERY_ID) ?: ""),
                        "pickup" to origin,
                        "destination" to dest,
                        "price" to fee,
                        "origin_address" to origin,
                        "destination_address" to dest,
                        "fee" to fee,
                    )
                    result.success(map)
                }
                "accept" -> {
                    @Suppress("UNCHECKED_CAST")
                    val args = call.arguments as? Map<String, Any?>
                    val deliveryId = args?.get("deliveryId")?.toString() ?: intent?.getStringExtra(EXTRA_DELIVERY_ID) ?: ""
                    val openUrl = args?.get("openUrl")?.toString() ?: "/driver?accept_delivery=$deliveryId"
                    val main = Intent(this, MainActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        putExtra(MainActivity.EXTRA_OPEN_URL, openUrl)
                        putExtra(MainActivity.EXTRA_ACCEPT_DELIVERY_ID, deliveryId)
                    }
                    startActivity(main)
                    finish()
                    result.success(null)
                }
                "dismiss" -> {
                    finish()
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        window?.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
    }

    companion object {
        private const val CHANNEL = "com.quickhw.driver_app/overlay"
        const val EXTRA_DELIVERY_ID = "delivery_id"
        const val EXTRA_ORIGIN = "origin"
        const val EXTRA_DEST = "destination"
        const val EXTRA_FEE = "fee"
    }
}

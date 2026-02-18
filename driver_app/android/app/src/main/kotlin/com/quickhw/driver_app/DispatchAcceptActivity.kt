package com.quickhw.driver_app

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import com.quickhw.driver_app.R

/**
 * 배차 수락 전체화면 팝업.
 * Full Screen Intent로 호출되며, 잠금화면/다른 앱 위에 표시됨.
 * 수락 시 MainActivity를 띄우고 delivery_id를 전달.
 */
class DispatchAcceptActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setShowWhenLockedAndTurnScreenOn()
        setContentView(R.layout.activity_dispatch_accept)

        val deliveryId = intent.getStringExtra(EXTRA_DELIVERY_ID) ?: ""
        val body = intent.getStringExtra(EXTRA_BODY) ?: "배송 요청이 도착했습니다."

        findViewById<TextView>(R.id.dispatch_message).text = body

        findViewById<Button>(R.id.btn_accept).setOnClickListener {
            val main = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(MainActivity.EXTRA_ACCEPT_DELIVERY_ID, deliveryId)
                putExtra(MainActivity.EXTRA_OPEN_URL, "/driver?accept_delivery=$deliveryId")
            }
            startActivity(main)
            finish()
        }

        findViewById<Button>(R.id.btn_reject).setOnClickListener {
            finish()
        }
    }

    private fun setShowWhenLockedAndTurnScreenOn() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            km.requestDismissKeyguard(this, null)
        }
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
    }

    companion object {
        const val EXTRA_DELIVERY_ID = "delivery_id"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
    }
}

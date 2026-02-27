package com.quickhw.driver_app

import android.app.Activity
import android.os.Bundle
import android.app.Application

/**
 * Application 클래스: ActivityLifecycleCallbacks로 앱의 실제 포그라운드 상태를 추적.
 * getRunningTasks()는 deprecated + 백그라운드 앱도 포그라운드로 잘못 판단하는 문제가 있어
 * 이 방식으로 대체.
 *
 * isForeground == true  → 앱이 화면에 보임 (오버레이 X, WebView 주입만)
 * isForeground == false → 앱이 백그라운드이거나 종료됨 (오버레이 O)
 */
class DriverApp : Application() {

    companion object {
        @Volatile
        var isForeground: Boolean = false
            private set

        private var resumedCount = 0
    }

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) {
                resumedCount++
                isForeground = true
            }

            override fun onActivityPaused(activity: Activity) {
                resumedCount--
                if (resumedCount <= 0) {
                    resumedCount = 0
                    isForeground = false
                }
            }

            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityStarted(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
    }
}

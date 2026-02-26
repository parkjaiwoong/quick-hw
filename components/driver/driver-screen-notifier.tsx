"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * 기사앱 WebView: 현재 화면을 Flutter에 전달.
 * 배송대기중(/driver/available)에서만 FCM 수신 시 오버레이·배송대기중 표시.
 */
export function DriverScreenNotifier() {
  const pathname = usePathname()

  useEffect(() => {
    const ch = (window as Window & { DriverScreenChannel?: { postMessage: (s: string) => void } })
      .DriverScreenChannel
    if (!ch) return
    const screen = pathname === "/driver/available" ? "available" : "main"
    ch.postMessage(screen)
  }, [pathname])

  return null
}

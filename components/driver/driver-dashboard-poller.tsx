"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const POLL_INTERVAL_MS = 12_000 // 12초마다 서버 데이터 갱신 (AJAX처럼 화면 갱신)

/**
 * 기사 대시보드는 서버 컴포넌트라 한 번 로드 후 갱신이 안 됨.
 * 이 컴포넌트가 주기적으로 router.refresh()를 호출해 서버를 다시 fetch 하여
 * 대기/진행 중 배송 목록 등이 자동으로 갱신되도록 함.
 */
export function DriverDashboardPoller() {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      router.refresh()
    }, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [router])

  return null
}

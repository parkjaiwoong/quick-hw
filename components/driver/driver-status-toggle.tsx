"use client"

import { useState, useEffect, useRef } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { updateDriverAvailability, updateDriverLocation } from "@/lib/actions/driver"
import { useRouter } from "next/navigation"

/** 기사 앱 WebView에만 노출됨. 배송 가능 상태를 네이티브에 전달해 FCM 백그라운드 시 오버레이 노출 여부에 사용 */
function notifyAppAvailability(available: boolean) {
  if (typeof window === "undefined") return
  const ch = (window as Window & { AvailabilityChannel?: { postMessage: (s: string) => void } })
    .AvailabilityChannel
  if (ch) ch.postMessage(available ? "true" : "false")
}

/** 백그라운드에서 GPS 위치를 가져와 서버에 저장 (페이지 이동을 블로킹하지 않음) */
function syncLocationInBackground() {
  if (typeof window === "undefined" || !("geolocation" in navigator)) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      updateDriverLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {})
    },
    () => {},
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
  )
}

interface DriverStatusToggleProps {
  initialStatus: boolean
  /** false로 변경 시 이동할 경로 (예: /driver) */
  redirectToOnTurnOff?: string
}

export function DriverStatusToggle({ initialStatus, redirectToOnTurnOff }: DriverStatusToggleProps) {
  const router = useRouter()
  const [isAvailable, setIsAvailable] = useState(initialStatus)
  const [isLoading, setIsLoading] = useState(false)
  const prefetchedRef = useRef(false)

  // 기사 앱 WebView 로드 시 서버의 초기 상태를 네이티브에 동기화
  useEffect(() => {
    notifyAppAvailability(initialStatus)
  }, [initialStatus])

  // 컴포넌트 마운트 시 대기중인 배송 페이지를 미리 prefetch
  useEffect(() => {
    if (!prefetchedRef.current) {
      router.prefetch("/driver/available")
      prefetchedRef.current = true
    }
  }, [router])

  async function handleToggle(checked: boolean) {
    setIsLoading(true)
    setIsAvailable(checked) // 낙관적 UI 업데이트

    if (checked) {
      // 배송가능 ON: DB 저장과 동시에 즉시 페이지 이동, 위치는 백그라운드 처리
      notifyAppAvailability(true)
      syncLocationInBackground()

      const result = await updateDriverAvailability(true)
      if (result.error) {
        setIsAvailable(false) // 롤백
        setIsLoading(false)
        alert(result.error)
        return
      }
      setIsLoading(false)
      router.push("/driver/available")
    } else {
      // 배송가능 OFF: DB 저장 후 메인으로 이동
      notifyAppAvailability(false)
      const result = await updateDriverAvailability(false)
      if (result.error) {
        setIsAvailable(true) // 롤백
        setIsLoading(false)
        alert(result.error)
        return
      }
      setIsLoading(false)
      if (redirectToOnTurnOff) {
        router.push(redirectToOnTurnOff)
      } else {
        router.refresh()
      }
    }
  }

  return (
    <div className="flex items-center gap-3 bg-card p-4 rounded-lg border">
      <Switch id="availability" checked={isAvailable} onCheckedChange={handleToggle} disabled={isLoading} />
      <Label htmlFor="availability" className="cursor-pointer">
        <span className="font-semibold">{isAvailable ? "배송 가능" : "배송 불가"}</span>
        <span className="block text-xs text-muted-foreground">
          {isAvailable ? "새 배송을 받을 수 있습니다" : "새 배송을 받지 않습니다"}
        </span>
      </Label>
    </div>
  )
}

"use client"

import { useState, useEffect, startTransition } from "react"
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

interface DriverStatusToggleProps {
  initialStatus: boolean
  /** false로 변경 시 이동할 경로 (예: /driver) */
  redirectToOnTurnOff?: string
}

export function DriverStatusToggle({ initialStatus, redirectToOnTurnOff }: DriverStatusToggleProps) {
  const router = useRouter()
  const [isAvailable, setIsAvailable] = useState(initialStatus)
  const [isLoading, setIsLoading] = useState(false)

  // 기사 앱 WebView 로드 시 서버의 초기 상태를 네이티브에 동기화
  useEffect(() => {
    notifyAppAvailability(initialStatus)
  }, [initialStatus])

  async function handleToggle(checked: boolean) {
    setIsLoading(true)
    const result = await updateDriverAvailability(checked)
    if (result.error) {
      setIsLoading(false)
      alert(result.error)
      return
    }
    setIsAvailable(checked)
    setIsLoading(false)
    notifyAppAvailability(checked)
    const doRefresh = () => startTransition(() => router.refresh())
    if (checked) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await updateDriverLocation(pos.coords.latitude, pos.coords.longitude)
            doRefresh()
            router.push("/driver/available")
          },
          () => {
            doRefresh()
            router.push("/driver/available")
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        )
      } else {
        doRefresh()
        router.push("/driver/available")
      }
    } else {
      doRefresh()
      if (redirectToOnTurnOff) {
        router.push(redirectToOnTurnOff)
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

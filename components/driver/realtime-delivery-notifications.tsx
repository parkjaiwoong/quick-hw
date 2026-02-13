"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { acceptDelivery } from "@/lib/actions/driver"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MapPin, Package } from "lucide-react"

interface DeliveryNotification {
  id: string
  delivery_id: string
  title: string
  message: string
  type: string
  created_at: string
}

interface LatestNewDelivery {
  delivery: {
    id: string
    pickup_address: string
    delivery_address: string
    distance_km?: number
    total_fee?: number
    driver_fee?: number
  }
  notificationId: string
}

export function RealtimeDeliveryNotifications({ userId }: { userId: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [userInteracted, setUserInteracted] = useState(false)
  const [latestNewDelivery, setLatestNewDelivery] = useState<LatestNewDelivery | null>(null)
  const [acceptLoading, setAcceptLoading] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const toastRef = useRef(toast)
  const routerRef = useRef(router)

  // toast와 router의 최신 참조 유지
  useEffect(() => {
    toastRef.current = toast
    routerRef.current = router
  }, [toast, router])

  // 사용자 상호작용 감지 (소리 재생을 위해 필요)
  useEffect(() => {
    const enableSound = () => {
      setUserInteracted(true)
    }

    // 페이지 로드 시 한 번 클릭하면 소리 활성화
    const events = ["click", "touchstart", "keydown"]
    events.forEach((event) => {
      document.addEventListener(event, enableSound, { once: true })
    })

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, enableSound)
      })
    }
  }, [])

  // 띵동 효과음 (Web Audio API). 사용자 상호작용 없이도 시도(일부 환경에서 재생됨)
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const playBeep = (frequency: number, delay: number) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()
          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)
          oscillator.frequency.value = frequency
          oscillator.type = "sine"
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.2)
        }, delay)
      }
      playBeep(800, 0)
      playBeep(600, 200)
    } catch (error) {
      console.warn("소리 재생 실패(정상일 수 있음):", error)
    }
  }, [])

  // 진동 (Vibration API, 모바일 지원)
  const playVibration = useCallback(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([200, 100, 200]) // 진동-쉬기-진동 (띵동 느낌)
      } catch {
        // ignore
      }
    }
  }, [])

  // 실시간 알림 구독
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    supabaseRef.current = supabase

    // 배송 요청 알림만 필터링 (type이 'new_delivery_request'인 것)
    const channel = supabase
      .channel(`driver-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          try {
            const notification = payload.new as DeliveryNotification

            // 배송 요청 알림만 처리
            if (
              (notification.type === "new_delivery_request" || notification.type === "new_delivery") &&
              notification.delivery_id
            ) {
              // 받을 수 있는 배송 목록 실시간 갱신
              routerRef.current.refresh()

              // 배송 정보 가져오기
              const { data: delivery, error: deliveryError } = await supabase
                .from("deliveries")
                .select("id, pickup_address, delivery_address, distance_km, total_fee, driver_fee")
                .eq("id", notification.delivery_id)
                .single()

              if (deliveryError) {
                console.error("배송 정보 가져오기 실패:", deliveryError)
                return
              }

              if (delivery) {
              const notificationId = notification.id
              const deliveryId = notification.delivery_id

              // 최신 요청을 목록 위 모달로 표시 (즉시 수락 가능)
              setLatestNewDelivery({
                delivery: {
                  id: delivery.id,
                  pickup_address: delivery.pickup_address,
                  delivery_address: delivery.delivery_address,
                  distance_km: delivery.distance_km,
                  total_fee: delivery.total_fee,
                  driver_fee: delivery.driver_fee,
                },
                notificationId,
              })

              // 모달 표시 후 띵동 + 진동 (모달은 userInteracted 무관하게 표시)
              playNotificationSound()
              playVibration()

              toastRef.current({
                title: "📦 새 배송 요청 도착",
                description: "아래 모달에서 수락하거나 목록에서 확인하세요.",
                duration: 5000,
                className: "border-blue-200 bg-blue-50",
              })
            }
          }
          } catch (error) {
            console.error("실시간 알림 처리 오류:", error)
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("실시간 알림 구독 성공")
        } else if (status === "CHANNEL_ERROR") {
          console.error("실시간 알림 채널 오류")
        } else if (status === "TIMED_OUT") {
          console.error("실시간 알림 구독 시간 초과")
        } else if (status === "CLOSED") {
          console.warn("실시간 알림 채널 닫힘")
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, playNotificationSound, playVibration])

  const handleAccept = async () => {
    if (!latestNewDelivery || acceptLoading) return
    setAcceptLoading(true)
    const result = await acceptDelivery(latestNewDelivery.delivery.id)
    if (result.error) {
      toast({ title: "오류", description: result.error, variant: "destructive" })
      setAcceptLoading(false)
      return
    }
    if (supabaseRef.current) {
      await supabaseRef.current
        .from("notifications")
        .update({ is_read: true })
        .eq("id", latestNewDelivery.notificationId)
    }
    toast({ title: "✅ 배송 수락 완료", description: "배송을 수락했습니다." })
    setLatestNewDelivery(null)
    setAcceptLoading(false)
    router.refresh()
  }

  const handleDecline = async () => {
    if (!latestNewDelivery) return
    if (supabaseRef.current) {
      await supabaseRef.current
        .from("notifications")
        .update({ is_read: true })
        .eq("id", latestNewDelivery.notificationId)
    }
    setLatestNewDelivery(null)
    router.refresh()
  }

  return (
    <Dialog open={!!latestNewDelivery} onOpenChange={(open) => !open && setLatestNewDelivery(null)}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg" showCloseButton={true}>
        {latestNewDelivery && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                새 배송 요청 (즉시 수락 가능)
              </DialogTitle>
              <DialogDescription>
              수락하시면 배송 상세로 이동합니다. (페이지를 한 번 터치하면 다음 알림부터 소리가 재생됩니다)
            </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-green-600" /> 출발지
                </p>
                <p className="text-sm text-muted-foreground pl-5">{latestNewDelivery.delivery.pickup_address}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-red-600" /> 도착지
                </p>
                <p className="text-sm text-muted-foreground pl-5">{latestNewDelivery.delivery.delivery_address}</p>
              </div>
              <div className="flex gap-4 text-sm">
                {latestNewDelivery.delivery.distance_km != null && (
                  <span className="text-muted-foreground">거리 {latestNewDelivery.delivery.distance_km.toFixed(1)}km</span>
                )}
                {(latestNewDelivery.delivery.driver_fee ?? latestNewDelivery.delivery.total_fee) != null && (
                  <span className="font-semibold">
                    {Number(latestNewDelivery.delivery.driver_fee ?? latestNewDelivery.delivery.total_fee).toLocaleString()}원
                  </span>
                )}
              </div>
            </div>
            <DialogFooter className="flex-row gap-2 sm:gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDecline}
                disabled={acceptLoading}
              >
                거절
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleAccept}
                disabled={acceptLoading}
              >
                {acceptLoading ? "처리 중…" : "수락"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

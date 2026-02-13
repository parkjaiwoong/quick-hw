"use client"

import { useCallback, useEffect, useRef, useState, startTransition } from "react"
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

// 띵동 소리 (사용자 터치 시 재생 보장. 볼륨 키우면 들림)
function playDingDongSound(ctxRef: { current: AudioContext | null }) {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return
    if (!ctxRef.current) ctxRef.current = new Ctor()
    const ctx = ctxRef.current
    if (ctx.state === "suspended") ctx.resume()
    const playBeep = (frequency: number, delay: number) => {
      setTimeout(() => {
        try {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = frequency
          osc.type = "sine"
          gain.gain.setValueAtTime(0.35, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
          osc.start(ctx.currentTime)
          osc.stop(ctx.currentTime + 0.25)
        } catch (_) {}
      }, delay)
    }
    playBeep(800, 0)
    playBeep(600, 220)
  } catch (_) {}
}

// 진동: 무조건 시도 (지원 시 항상 동작하도록)
function triggerVibration() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200])
    }
  } catch (_) {}
}

export function RealtimeDeliveryNotifications({ userId }: { userId: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [latestNewDelivery, setLatestNewDelivery] = useState<LatestNewDelivery | null>(null)
  const [acceptLoading, setAcceptLoading] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const toastRef = useRef(toast)
  const routerRef = useRef(router)
  const audioContextRef = useRef<AudioContext | null>(null)
  const soundPlayedForCurrentRef = useRef(false)

  useEffect(() => {
    toastRef.current = toast
    routerRef.current = router
  }, [toast, router])

  // 모달이 뜬 직후 진동 한 번 더 (콜백과 동시에 느껴지도록)
  useEffect(() => {
    if (!latestNewDelivery) {
      soundPlayedForCurrentRef.current = false
      return
    }
    triggerVibration()
  }, [latestNewDelivery])

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
              const payload = {
                delivery: {
                  id: delivery.id,
                  pickup_address: delivery.pickup_address,
                  delivery_address: delivery.delivery_address,
                  distance_km: delivery.distance_km,
                  total_fee: delivery.total_fee,
                  driver_fee: delivery.driver_fee,
                },
                notificationId,
              }
              // 진동: 모달과 동시에 나오도록 setState 직전에 즉시 실행
              triggerVibration()
              setLatestNewDelivery(payload)
              // 띵동 소리: 시도 (볼륨 있으면 재생. 브라우저 제한 시 모달 터치로 재생)
              playDingDongSound(audioContextRef)

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
  }, [userId])

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
    startTransition(() => router.refresh())
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
    startTransition(() => router.refresh())
  }

  // 모달 터치 시: 소리만 (브라우저가 자동재생 막았을 때 볼륨 키우고 터치하면 띵동)
  const onModalInteraction = useCallback(() => {
    if (!soundPlayedForCurrentRef.current) {
      soundPlayedForCurrentRef.current = true
      playDingDongSound(audioContextRef)
    }
  }, [])

  return (
    <Dialog open={!!latestNewDelivery} onOpenChange={(open) => !open && setLatestNewDelivery(null)}>
      <DialogContent
        className="max-w-[calc(100vw-2rem)] sm:max-w-lg"
        showCloseButton={true}
        onPointerDown={onModalInteraction}
        onTouchStart={onModalInteraction}
      >
        {latestNewDelivery && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                새 배송 요청 (즉시 수락 가능)
              </DialogTitle>
              <DialogDescription>
              수락하시면 배송 상세로 이동합니다. 소리가 안 들리면 모달을 터치하면 띵동이 재생됩니다.
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

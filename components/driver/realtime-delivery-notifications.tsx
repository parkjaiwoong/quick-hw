"use client"

import { useCallback, useEffect, useRef, useState, startTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { acceptDelivery } from "@/lib/actions/driver"
import { useRouter } from "next/navigation"
import { MapPin, Package, X } from "lucide-react"

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

// 띵동 소리 (사용자 터치 시 재생 보장)
function playDingDongSound(ctxRef: { current: AudioContext | null }) {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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

function triggerVibration() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200])
    }
  } catch (_) {}
}

// 주소 한 줄 요약 (동/읍면 수준)
function shortenAddress(addr: string, maxLen = 18) {
  if (!addr || addr.length <= maxLen) return addr
  const trimmed = addr.trim()
  if (trimmed.length <= maxLen) return trimmed
  return trimmed.slice(0, maxLen - 1) + "…"
}

export function RealtimeDeliveryNotifications({ userId }: { userId: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [latestNewDelivery, setLatestNewDelivery] = useState<LatestNewDelivery | null>(null)
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default")
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const routerRef = useRef(router)
  const audioContextRef = useRef<AudioContext | null>(null)
  const soundPlayedForCurrentRef = useRef(false)

  useEffect(() => {
    routerRef.current = router
  }, [router])

  // 배송원 대시 진입 시 알림 권한 요청 (탭이 백그라운드일 때도 알림 받기 위함)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "granted") {
      setNotificationPermission("granted")
      return
    }
    if (Notification.permission === "denied") {
      setNotificationPermission("denied")
      return
    }
    const t = setTimeout(() => {
      Notification.requestPermission().then((p) => setNotificationPermission(p))
    }, 800)
    return () => clearTimeout(t)
  }, [])

  // Flutter 앱에서 FCM 토큰 전달 시 서버에 등록 (앱 백그라운드/종료 시에도 푸시 수신)
  useEffect(() => {
    const handler = (e: Event) => {
      const token = (e as CustomEvent<string>).detail
      if (!token) return
      fetch("/api/driver/fcm-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "same-origin",
      }).catch(() => {})
    }
    window.addEventListener("driverFcmToken", handler)
    return () => window.removeEventListener("driverFcmToken", handler)
  }, [])

  // Web Push 구독: 탭을 완전히 닫아도 배송 요청 시 시스템 알림 수신
  useEffect(() => {
    if (notificationPermission !== "granted" || !("serviceWorker" in navigator) || !("PushManager" in window)) return
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublic) return

    let cancelled = false
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        await reg.update()
        const sub = await reg.pushManager.getSubscription()
        const subscription = sub || (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublic,
        }))
        if (cancelled) return
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
          }),
          credentials: "same-origin",
        })
        if (!res.ok) console.warn("Web Push 구독 등록 실패:", await res.text())
      } catch (e) {
        if (!cancelled) console.warn("Web Push 구독 오류:", e)
      }
    })()
    return () => { cancelled = true }
  }, [notificationPermission])

  // 팝업 표시 시 진동
  useEffect(() => {
    if (!latestNewDelivery) {
      soundPlayedForCurrentRef.current = false
      return
    }
    triggerVibration()
  }, [latestNewDelivery])

  // 시스템 알림 표시 (탭이 백그라운드일 때, 다른 작업 중일 때)
  const showBrowserNotification = useCallback((payload: LatestNewDelivery) => {
    if (typeof window === "undefined" || !("Notification" in window) || notificationPermission !== "granted") return
    const d = payload.delivery
    const from = shortenAddress(d.pickup_address, 20)
    const to = shortenAddress(d.delivery_address, 20)
    const fee = (d.driver_fee ?? d.total_fee) != null
      ? `${Number(d.driver_fee ?? d.total_fee).toLocaleString()}원`
      : ""
    const body = [from, to].filter(Boolean).join(" → ") + (fee ? ` · ${fee}` : "")
    try {
      const n = new Notification("📦 새 배송 요청 (수락 가능)", {
        body,
        tag: "delivery-request",
        requireInteraction: true,
        icon: "/icon.svg",
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
    } catch (_) {}
  }, [notificationPermission])

  // 실시간 알림 구독
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    supabaseRef.current = supabase

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
            if (
              (notification.type === "new_delivery_request" || notification.type === "new_delivery") &&
              notification.delivery_id
            ) {
              routerRef.current.refresh()

              const { data: delivery, error: deliveryError } = await supabase
                .from("deliveries")
                .select("id, pickup_address, delivery_address, distance_km, total_fee, driver_fee")
                .eq("id", notification.delivery_id)
                .single()

              if (deliveryError || !delivery) return

              const payloadData: LatestNewDelivery = {
                delivery: {
                  id: delivery.id,
                  pickup_address: delivery.pickup_address,
                  delivery_address: delivery.delivery_address,
                  distance_km: delivery.distance_km,
                  total_fee: delivery.total_fee,
                  driver_fee: delivery.driver_fee,
                },
                notificationId: notification.id,
              }

              triggerVibration()
              setLatestNewDelivery(payloadData)
              playDingDongSound(audioContextRef)

              if (document.visibilityState === "hidden") {
                showBrowserNotification(payloadData)
              }

              toast({
                title: "📦 새 배송 요청 도착",
                description: "아래에서 수락하거나 거절하세요.",
                duration: 5000,
                className: "border-blue-200 bg-blue-50",
              })
            }
          } catch (error) {
            console.error("실시간 알림 처리 오류:", error)
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("실시간 알림 구독 성공")
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("실시간 알림 구독 오류:", status)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, toast, showBrowserNotification])

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

  const onPopupInteraction = useCallback(() => {
    if (!soundPlayedForCurrentRef.current) {
      soundPlayedForCurrentRef.current = true
      playDingDongSound(audioContextRef)
    }
  }, [])

  // 카카오T 픽커 스타일: 하단 고정 플로팅 팝업 (띵동 + 진동 + 작은 팝업으로 바로 확인)
  return (
    <>
      {latestNewDelivery && (
        <div
          role="alertdialog"
          aria-labelledby="delivery-popup-title"
          className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col rounded-t-2xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom duration-300"
          onPointerDown={onPopupInteraction}
          onTouchStart={onPopupInteraction}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 text-blue-600">
              <Package className="h-5 w-5 shrink-0" />
              <span id="delivery-popup-title" className="font-semibold">새 배송 요청</span>
            </div>
            <button
              type="button"
              aria-label="닫기"
              className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
              onClick={handleDecline}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-green-600" />
              <span className="text-muted-foreground truncate">{shortenAddress(latestNewDelivery.delivery.pickup_address, 24)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-red-600" />
              <span className="text-muted-foreground truncate">{shortenAddress(latestNewDelivery.delivery.delivery_address, 24)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-muted-foreground">
                {latestNewDelivery.delivery.distance_km != null && `${latestNewDelivery.delivery.distance_km.toFixed(1)}km`}
                {(latestNewDelivery.delivery.driver_fee ?? latestNewDelivery.delivery.total_fee) != null && (
                  <span className="ml-2 font-semibold text-foreground">
                    {Number(latestNewDelivery.delivery.driver_fee ?? latestNewDelivery.delivery.total_fee).toLocaleString()}원
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-4 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          </div>
          <div className="h-1 w-16 mx-auto rounded-full bg-gray-200 mb-1" aria-hidden />
        </div>
      )}
    </>
  )
}

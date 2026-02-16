"use client"

import { useCallback, useEffect, useRef, useState, startTransition } from "react"
import { createPortal, flushSync } from "react-dom"
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

interface RealtimeDeliveryNotificationsProps {
  userId: string
  /** 배송 불가면 새 배송 요청 알림이 오지 않음(연결 상태는 유지). 화면 문구 구분용 */
  isAvailable?: boolean
}

/** refresh() 후 리마운트되어도 모달 복원용 (모듈 변수) */
let pendingNewDelivery: LatestNewDelivery | null = null

export function RealtimeDeliveryNotifications({ userId, isAvailable = true }: RealtimeDeliveryNotificationsProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [latestNewDelivery, setLatestNewDelivery] = useState<LatestNewDelivery | null>(null)
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default")
  const [realtimeStatus, setRealtimeStatus] = useState<"idle" | "subscribed" | "error">("idle")
  const [retryKey, setRetryKey] = useState(0)
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const routerRef = useRef(router)
  const audioContextRef = useRef<AudioContext | null>(null)
  const soundPlayedForCurrentRef = useRef(false)
  const audioUnlockedRef = useRef(false)

  // 사용자 제스처 시 AudioContext 언락 (자동재생 정책 통과 — 그래야 나중에 띵동 소리 재생 가능)
  useEffect(() => {
    if (typeof document === "undefined") return
    const unlock = () => {
      if (audioUnlockedRef.current) return
      audioUnlockedRef.current = true
      try {
        if (!audioContextRef.current) {
          const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          if (Ctor) audioContextRef.current = new Ctor()
        }
        const ctx = audioContextRef.current
        if (ctx?.state === "suspended") ctx.resume()
      } catch (_) {}
    }
    const opts = { capture: true, passive: true }
    document.addEventListener("touchstart", unlock, opts)
    document.addEventListener("pointerdown", unlock, opts)
    return () => {
      document.removeEventListener("touchstart", unlock, opts)
      document.removeEventListener("pointerdown", unlock, opts)
    }
  }, [])

  // ref에서 사용하므로 반드시 ref보다 먼저 정의 (선언 전 참조 방지)
  const showBrowserNotification = useCallback((payload: LatestNewDelivery) => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return
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
  }, [])

  const toastRef = useRef(toast)
  const showBrowserNotificationRef = useRef(showBrowserNotification)
  useEffect(() => {
    routerRef.current = router
  }, [router])
  useEffect(() => {
    toastRef.current = toast
    showBrowserNotificationRef.current = showBrowserNotification
  }, [toast, showBrowserNotification])

  // 배송원 대시 진입 시 알림 권한 상태 동기화 (실제 권한은 Notification.permission으로 사용)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    setNotificationPermission(Notification.permission)
  }, [])

  const requestNotificationPermission = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    Notification.requestPermission().then((p) => setNotificationPermission(p))
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

  // refresh() 후 리마운트되면 보류 중인 알림 복원 → 목록 갱신 + 모달/진동/소리 유지
  useEffect(() => {
    if (pendingNewDelivery == null) return
    const payload = pendingNewDelivery
    pendingNewDelivery = null
    setLatestNewDelivery(payload)
    triggerVibration()
    playDingDongSound(audioContextRef)
  }, [])

  // 이벤트 수신 표시 30초 후 제거
  useEffect(() => {
    if (lastEventAt == null) return
    const t = setTimeout(() => setLastEventAt(null), 30000)
    return () => clearTimeout(t)
  }, [lastEventAt])

  // 팝업 표시 시 진동
  useEffect(() => {
    if (!latestNewDelivery) {
      soundPlayedForCurrentRef.current = false
      return
    }
    triggerVibration()
  }, [latestNewDelivery])

  // 앱 전환 후 복귀 시 재연결: 카카오 등 다른 앱 갔다가 돌아오면 WebSocket이 끊겨 '연결 실패'가 나므로, 포그라운드 복귀 시 재구독
  useEffect(() => {
    if (typeof document === "undefined") return
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      if (realtimeStatus === "error") {
        setRetryKey((k) => k + 1)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [realtimeStatus])

  // 실시간 알림 구독 (userId 또는 retryKey 변경 시 재구독 — 앱 복귀 시 재연결)
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    supabaseRef.current = supabase

    const channel = supabase
      .channel(`driver-notifications:${userId}-${retryKey}`)
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
              setLastEventAt(Date.now())

              let delivery: { id: string; pickup_address: string; delivery_address: string; distance_km?: number; total_fee?: number; driver_fee?: number } | null = null
              const { data: deliveryRow, error: deliveryError } = await supabase
                .from("deliveries")
                .select("id, pickup_address, delivery_address, distance_km, total_fee, driver_fee")
                .eq("id", notification.delivery_id)
                .single()
              if (!deliveryError && deliveryRow) delivery = deliveryRow

              if (!delivery) {
                const res = await fetch(
                  `/api/driver/delivery-for-notification?deliveryId=${encodeURIComponent(notification.delivery_id)}`,
                  { credentials: "same-origin" }
                )
                const json = await res.json().catch(() => null)
                if (json?.delivery) delivery = json.delivery
              }

              const payloadData: LatestNewDelivery = delivery
                ? {
                    delivery: {
                      id: delivery.id,
                      pickup_address: delivery.pickup_address ?? "",
                      delivery_address: delivery.delivery_address ?? "",
                      distance_km: delivery.distance_km,
                      total_fee: delivery.total_fee,
                      driver_fee: delivery.driver_fee,
                    },
                    notificationId: notification.id,
                  }
                : {
                    delivery: {
                      id: notification.delivery_id,
                      pickup_address: "상세 불러오기 실패",
                      delivery_address: "목록에서 확인해 주세요",
                    },
                    notificationId: notification.id,
                  }

              pendingNewDelivery = payloadData
              routerRef.current.refresh()
              triggerVibration()
              playDingDongSound(audioContextRef)
              flushSync(function () {
                setLatestNewDelivery(payloadData)
              })

              if (document.visibilityState === "hidden") {
                showBrowserNotificationRef.current(payloadData)
              }

              toastRef.current({
                title: "📦 새 배송 요청 도착",
                description: delivery
                  ? "아래에서 수락하거나 거절하세요."
                  : "아래에서 수락하거나 목록에서 확인하세요.",
                duration: 5000,
                className: "border-blue-200 bg-blue-50",
              })
            }
          } catch (error) {
            console.error("실시간 알림 처리 오류:", error)
          }
        },
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("subscribed")
          console.log("실시간 알림 구독 성공")
          // 앱 복귀 후 재연결 시: 다른 앱 갔다 오는 동안 온 미확인 신규 요청이 있으면 모달로 표시
          try {
            const { data: rows } = await supabase
              .from("notifications")
              .select("id, delivery_id, type, created_at")
              .eq("user_id", userId)
              .eq("is_read", false)
              .in("type", ["new_delivery_request", "new_delivery"])
              .not("delivery_id", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
            const row = rows?.[0]
            if (row?.delivery_id) {
              const { data: delivery } = await supabase
                .from("deliveries")
                .select("id, pickup_address, delivery_address, distance_km, total_fee, driver_fee")
                .eq("id", row.delivery_id)
                .single()
              if (delivery) {
                setLatestNewDelivery({
                  delivery: {
                    id: delivery.id,
                    pickup_address: delivery.pickup_address,
                    delivery_address: delivery.delivery_address,
                    distance_km: delivery.distance_km,
                    total_fee: delivery.total_fee,
                    driver_fee: delivery.driver_fee,
                  },
                  notificationId: row.id,
                })
                triggerVibration()
                playDingDongSound(audioContextRef)
              }
            }
          } catch (_) {}
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("error")
          console.error("실시간 알림 구독 오류:", status)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, retryKey])

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
  // 모바일에서 F12 없이 상태 확인: 화면에 항상 "실시간 알림" 상태 표시
  return (
    <>
      {/* 실시간 알림 상태 (모바일에서 그냥 화면만 보면 됨, F12 불필요) */}
      <div
        className="fixed top-14 left-2 right-2 z-[89] flex flex-col items-center gap-1 pointer-events-none"
        aria-live="polite"
      >
        <div className="flex justify-center">
          {realtimeStatus === "subscribed" && (
            <span
              className={
                isAvailable
                  ? "inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-800 px-3 py-1.5 text-xs font-medium shadow-sm"
                  : "inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-600 px-3 py-1.5 text-xs shadow-sm"
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${isAvailable ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
                aria-hidden
              />
              {isAvailable ? "실시간 알림 연결됨" : "실시간 알림 연결됨 (배송 불가 — 새 요청 알림 없음)"}
            </span>
          )}
          {realtimeStatus === "idle" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-600 px-3 py-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-gray-400" aria-hidden />
              실시간 알림 연결 중…
            </span>
          )}
        </div>
        {lastEventAt != null && (
          <span className="text-[10px] text-green-700 bg-green-50/90 px-2 py-0.5 rounded">
            이벤트 수신됨 (방금)
          </span>
        )}
      </div>
      {realtimeStatus === "error" && (
        <div className="fixed top-16 left-2 right-2 z-[90] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm">
          <strong>실시간 알림 연결 실패.</strong> 새 배송 요청 시 띵동/진동이 올 수 없습니다. PC에서 Supabase SQL 또는 관리자에게 문의하세요.
        </div>
      )}
      {notificationPermission === "default" && realtimeStatus !== "error" && typeof window !== "undefined" && "Notification" in window && (
        <div className="fixed top-16 left-2 right-2 z-[90] rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 shadow-sm flex items-center justify-between gap-2">
          <span>다른 앱 사용 중에도 알림을 받으려면 알림을 허용해 주세요.</span>
          <Button type="button" size="sm" variant="secondary" className="shrink-0 text-xs" onClick={requestNotificationPermission}>
            알림 허용
          </Button>
        </div>
      )}
      {latestNewDelivery &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="alertdialog"
            aria-labelledby="delivery-popup-title"
            className="fixed inset-0 z-[2147483647] flex flex-col justify-end bg-black/20"
            style={{ pointerEvents: "auto" }}
          >
            <div className="flex-1 min-h-0" onClick={handleDecline} aria-hidden />
            <div
              className="flex flex-col rounded-t-2xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom duration-300"
              onPointerDown={onPopupInteraction}
              onTouchStart={onPopupInteraction}
              onClick={(e) => e.stopPropagation()}
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
          </div>,
          document.body
        )}
    </>
  )
}

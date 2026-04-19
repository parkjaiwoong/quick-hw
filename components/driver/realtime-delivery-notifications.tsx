"use client"

import { useCallback, useEffect, useRef, useState, startTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { MapPin, Package, X } from "lucide-react"
import { useDriverDeliveryRequest } from "@/lib/contexts/driver-delivery-request"
import { toAddressAbbrev } from "@/lib/address-abbrev"

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
    item_description?: string
    package_size?: string
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

const DRIVER_NEW_DELIVERY_EVENT = "driver-new-delivery-request"

interface RealtimeDeliveryNotificationsProps {
  userId: string
  /** 배송 불가면 새 배송 요청 알림이 오지 않음(연결 상태는 유지). 화면 문구 구분용 */
  isAvailable?: boolean
}

export function RealtimeDeliveryNotifications({ userId, isAvailable = true }: RealtimeDeliveryNotificationsProps) {
  const { toast } = useToast()
  const router = useRouter()
  const ctx = useDriverDeliveryRequest()
  const [latestNewDelivery, setLatestNewDelivery] = useState<LatestNewDelivery | null>(null)
  const [acceptLoading, setAcceptLoading] = useState(false)
  const setDeliveryState = ctx?.setLatestNewDelivery ?? setLatestNewDelivery
  const showPopup = !ctx && latestNewDelivery
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default")
  const [realtimeStatus, setRealtimeStatus] = useState<"idle" | "subscribed" | "error">("idle")
  const [mounted, setMounted] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const retryCountRef = useRef(0)
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const [eventReceiveCount, setEventReceiveCount] = useState(0)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const routerRef = useRef(router)
  const audioContextRef = useRef<AudioContext | null>(null)
  const soundPlayedForCurrentRef = useRef(false)
  const audioUnlockedRef = useRef(false)
  const setLatestNewDeliveryRef = useRef(setDeliveryState)
  const setEventReceiveCountRef = useRef(setEventReceiveCount)
  const setLastEventAtRef = useRef(setLastEventAt)
  const lastShownNotificationIdRef = useRef<string | null>(null)
  setLatestNewDeliveryRef.current = setDeliveryState
  setEventReceiveCountRef.current = setEventReceiveCount
  setLastEventAtRef.current = setLastEventAt

  // 클라이언트 마운트 후에만 렌더 (hydration 불일치 방지)
  useEffect(() => {
    setMounted(true)
  }, [])

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
  const registerFcmToken = useCallback((token: string) => {
    if (!token) return
    const suffix = token.length >= 24 ? token.slice(-24) : token
    console.log("[기사앱-웹] FCM 토큰 서버 등록 요청, 토큰 끝 24자(DB 대조용):", suffix)
    fetch("/api/driver/fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (res.ok) console.log("[기사앱-웹] FCM 토큰 서버 등록 성공 (끝 24자:", suffix + ")")
        else console.warn("[기사앱-웹] FCM 토큰 서버 등록 실패:", res.status, await res.text())
      })
      .catch((err) => console.warn("[기사앱-웹] FCM 토큰 서버 등록 오류:", err))
  }, [])

  useEffect(() => {
    const win = window as Window & { __driverFcmToken?: string }
    const tryRegisterFromWindow = () => {
      if (win.__driverFcmToken) {
        registerFcmToken(win.__driverFcmToken)
        delete win.__driverFcmToken
      }
    }
    tryRegisterFromWindow()
    const handler = (e: Event) => {
      const token = (e as CustomEvent<string>).detail
      registerFcmToken(token)
    }
    window.addEventListener("driverFcmToken", handler)
    const t1 = setTimeout(tryRegisterFromWindow, 500)
    const t2 = setTimeout(tryRegisterFromWindow, 2000)
    const t3 = setTimeout(tryRegisterFromWindow, 5000)
    return () => {
      window.removeEventListener("driverFcmToken", handler)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [registerFcmToken])

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

  // 이벤트 수신 표시 30초 후 제거
  useEffect(() => {
    if (lastEventAt == null) return
    const t = setTimeout(() => setLastEventAt(null), 30000)
    return () => clearTimeout(t)
  }, [lastEventAt])

  // 기사앱 포그라운드 FCM → WebView 배송대기중 영역 주입용
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<{ delivery: LatestNewDelivery["delivery"]; notificationId: string }>).detail
      if (!d?.delivery) return
      const payload: LatestNewDelivery = { delivery: d.delivery, notificationId: d.notificationId ?? `fcm-${d.delivery.id}` }
      setEventReceiveCount((c) => c + 1)
      setLastEventAt(Date.now())
      setDeliveryState(payload)
      // 배송대기중 카드 표출 시 진동+효과음
      triggerVibration()
      playDingDongSound(audioContextRef)
      startTransition(() => routerRef.current?.refresh())
    }
    window.addEventListener("driverNewDeliveryFcm", handler)
    return () => window.removeEventListener("driverNewDeliveryFcm", handler)
  }, [])

  // Realtime 수신 이벤트 (폴링/Realtime 콜백에서 dispatch)
  useEffect(() => {
    const handler = (e: Event) => {
      const { payloadData } = (e as CustomEvent<{ payloadData: LatestNewDelivery; hasDelivery: boolean }>).detail
      if (!payloadData) return
      setEventReceiveCount((c) => c + 1)
      setLastEventAt(Date.now())
      setDeliveryState(payloadData)
      // 배송대기중 카드 표출 시 진동+효과음
      triggerVibration()
      playDingDongSound(audioContextRef)
      startTransition(() => routerRef.current?.refresh())
    }
    window.addEventListener(DRIVER_NEW_DELIVERY_EVENT, handler)
    return () => window.removeEventListener(DRIVER_NEW_DELIVERY_EVENT, handler)
  }, [])

  // latestNewDelivery 변경 시 추가 진동 (state 경로로 들어온 경우 보완)
  useEffect(() => {
    if (!latestNewDelivery) {
      soundPlayedForCurrentRef.current = false
      return
    }
    if (!soundPlayedForCurrentRef.current) {
      soundPlayedForCurrentRef.current = true
      triggerVibration()
      playDingDongSound(audioContextRef)
    }
  }, [latestNewDelivery])

  // 앱 전환 후 복귀 시 재연결: 카카오 등 다른 앱 갔다가 돌아오면 WebSocket이 끊겨 '연결 실패'가 나므로, 포그라운드 복귀 시 재구독
  useEffect(() => {
    if (typeof document === "undefined") return
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      if (realtimeStatus === "error" || realtimeStatus === "idle") {
        retryCountRef.current = 0
        setRetryKey((k) => k + 1)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [realtimeStatus])

  // Realtime 미수신/CHANNEL_ERROR 시에도 폴링으로 알림 수신: 10초마다 미확인 신규 요청 조회 → UI/진동/소리
  useEffect(() => {
    if (!userId) return
    // subscribed: Realtime 정상 동작 중에도 폴링 병행 (누락 방지)
    // error/idle: Realtime 연결 실패 시 폴링이 주 수신 수단
    if (realtimeStatus === "idle" && retryCountRef.current === 0) return
    const supabase = supabaseRef.current
    if (!supabase) return

    const poll = async () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return
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
        if (!row?.delivery_id || row.id === lastShownNotificationIdRef.current) return

        const { data: delivery } = await supabase
          .from("deliveries")
          .select("id, pickup_address, delivery_address, distance_km, total_fee, driver_fee, item_description, package_size")
          .eq("id", row.delivery_id)
          .single()
        if (!delivery) return

        console.log("[기사-Realtime] 폴링으로 신규 알림 발견", { notificationId: row.id, deliveryId: row.delivery_id })
        lastShownNotificationIdRef.current = row.id
        setEventReceiveCountRef.current((c) => c + 1)
        setLastEventAtRef.current(Date.now())
        setLatestNewDeliveryRef.current({
          delivery: {
            id: delivery.id,
            pickup_address: delivery.pickup_address ?? "",
            delivery_address: delivery.delivery_address ?? "",
            distance_km: delivery.distance_km,
            total_fee: delivery.total_fee,
            driver_fee: delivery.driver_fee,
            item_description: delivery.item_description ?? undefined,
            package_size: delivery.package_size ?? undefined,
          },
          notificationId: row.id,
        })
        triggerVibration()
        playDingDongSound(audioContextRef)
        toastRef.current({
          title: "📦 새 배송 요청 도착",
          description: "아래에서 수락하거나 거절하세요.",
          duration: 5000,
          className: "border-blue-200 bg-blue-50",
        })
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(DRIVER_NEW_DELIVERY_EVENT, {
              detail: {
                payloadData: {
                  delivery: {
                    id: delivery.id,
                    pickup_address: delivery.pickup_address ?? "",
                    delivery_address: delivery.delivery_address ?? "",
                    distance_km: delivery.distance_km,
                    total_fee: delivery.total_fee,
                    driver_fee: delivery.driver_fee,
                  },
                  notificationId: row.id,
                },
                hasDelivery: true,
              },
            })
          )
        }
        startTransition(() => routerRef.current?.refresh())
      } catch (_) {}
    }

    const interval = setInterval(poll, 10000)
    poll()
    return () => clearInterval(interval)
  }, [userId, realtimeStatus])

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
            console.log("[기사-Realtime] INSERT 콜백 호출", {
              notificationId: notification?.id,
              deliveryId: notification?.delivery_id,
              type: notification?.type,
              userId: notification?.user_id,
              구독userId: userId,
            })
            if (
              (notification.type === "new_delivery_request" || notification.type === "new_delivery") &&
              notification.delivery_id
            ) {
              let delivery: { id: string; pickup_address: string; delivery_address: string; distance_km?: number; total_fee?: number; driver_fee?: number; item_description?: string; package_size?: string } | null = null
              const { data: deliveryRow, error: deliveryError } = await supabase
                .from("deliveries")
                .select("id, pickup_address, delivery_address, distance_km, total_fee, driver_fee, item_description, package_size")
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
                      item_description: delivery.item_description ?? undefined,
                      package_size: delivery.package_size ?? undefined,
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

              // 콜백에서 직접 UI/진동/소리 실행 (WebView·모바일에서 커스텀 이벤트가 지연/누락될 수 있어)
              if (typeof window !== "undefined") {
                console.log("[기사-Realtime] UI/진동/소리 실행", { deliveryId: payloadData.delivery.id, notificationId: payloadData.notificationId })
                lastShownNotificationIdRef.current = payloadData.notificationId
                setEventReceiveCountRef.current((c) => c + 1)
                setLastEventAtRef.current(Date.now())
                setLatestNewDeliveryRef.current(payloadData)
                triggerVibration()
                playDingDongSound(audioContextRef)
                if (document.visibilityState === "hidden") {
                  showBrowserNotificationRef.current(payloadData)
                }
                toastRef.current({
                  title: "📦 새 배송 요청 도착",
                  description: delivery ? "아래에서 수락하거나 거절하세요." : "아래에서 수락하거나 목록에서 확인하세요.",
                  duration: 5000,
                  className: "border-blue-200 bg-blue-50",
                })
                window.dispatchEvent(
                  new CustomEvent(DRIVER_NEW_DELIVERY_EVENT, {
                    detail: { payloadData, hasDelivery: !!delivery },
                  })
                )
                // Flutter WebView 브릿지: 기사앱에서 수신 시 오버레이 표시 (대기중인 배송 페이지 포함)
                const win = window as Window & { FlutterOverlayChannel?: { postMessage: (s: string) => void } }
                if (win.FlutterOverlayChannel && isAvailable) {
                  const overlayData = {
                    delivery_id: payloadData.delivery.id,
                    pickup: payloadData.delivery.pickup_address ?? "",
                    destination: payloadData.delivery.delivery_address ?? "",
                    price: payloadData.delivery.driver_fee != null ? `${payloadData.delivery.driver_fee.toLocaleString()}원` : payloadData.delivery.total_fee != null ? `${payloadData.delivery.total_fee.toLocaleString()}원` : "",
                    title: "신규 배차 요청",
                    body: `${payloadData.delivery.pickup_address ?? ""} → ${payloadData.delivery.delivery_address ?? ""}`,
                  }
                  try {
                    win.FlutterOverlayChannel.postMessage(JSON.stringify(overlayData))
                    console.log("[기사-Realtime] FlutterOverlayChannel.postMessage 호출", overlayData)
                  } catch (e) {
                    console.warn("[기사-Realtime] FlutterOverlayChannel 오류:", e)
                  }
                }
                // 수락 가능한 배송 목록 자동 갱신 (startTransition으로 스케줄해 확실히 반영)
                startTransition(() => routerRef.current?.refresh())
              }
            } else {
              console.log("[기사-Realtime] INSERT 스킵(타입/ delivery_id 아님)", {
                type: notification?.type,
                delivery_id: notification?.delivery_id,
              })
            }
          } catch (error) {
            console.error("[기사-Realtime] 실시간 알림 처리 오류:", error)
          }
        },
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("subscribed")
          retryCountRef.current = 0
          console.log("[기사-Realtime] 실시간 알림 구독 성공 userId:", userId)
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
                .select("id, pickup_address, delivery_address, distance_km, total_fee, driver_fee, item_description, package_size")
                .eq("id", row.delivery_id)
                .single()
              if (delivery) {
                lastShownNotificationIdRef.current = row.id
                setLatestNewDeliveryRef.current({
                  delivery: {
                    id: delivery.id,
                    pickup_address: delivery.pickup_address,
                    delivery_address: delivery.delivery_address,
                    distance_km: delivery.distance_km,
                    total_fee: delivery.total_fee,
                    driver_fee: delivery.driver_fee,
                    item_description: delivery.item_description ?? undefined,
                    package_size: delivery.package_size ?? undefined,
                  },
                  notificationId: row.id,
                })
                triggerVibration()
                playDingDongSound(audioContextRef)
                startTransition(() => routerRef.current?.refresh())
              }
            }
          } catch (_) {}
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          retryCountRef.current += 1
          const isTimedOut = status === "TIMED_OUT"
          // TIMED_OUT은 네트워크 일시 단절로 warn, CHANNEL_ERROR는 설정 문제로 warn (폴링이 커버)
          console.warn(
            `[기사-Realtime] 구독 ${isTimedOut ? "타임아웃" : "오류"} (시도 ${retryCountRef.current}회) - 폴링으로 계속 수신 중`
          )
          // 최대 10회까지 지수 백오프로 재시도 (5s → 10s → 20s → ... 최대 60s)
          if (retryCountRef.current <= 10) {
            const delay = Math.min(5000 * Math.pow(2, retryCountRef.current - 1), 60000)
            setTimeout(() => setRetryKey((k) => k + 1), delay)
          } else {
            // 10회 초과 시 에러 상태로 전환 (UI에 연결 실패 배너 표시)
            setRealtimeStatus("error")
          }
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, retryKey])

  const deliveryForActions = ctx?.latestNewDelivery ?? latestNewDelivery
  const handleAccept = ctx?.handleAccept ?? (async () => {
    if (!deliveryForActions || acceptLoading) return
    setAcceptLoading(true)
    const { acceptDelivery } = await import("@/lib/actions/driver")
    const result = await acceptDelivery(deliveryForActions.delivery.id)
    if (result.error) {
      toast({ title: "오류", description: result.error, variant: "destructive" })
      setAcceptLoading(false)
      return
    }
    if (supabaseRef.current) {
      await supabaseRef.current
        .from("notifications")
        .update({ is_read: true })
        .eq("id", deliveryForActions.notificationId)
    }
    toast({ title: "✅ 배송 수락 완료", description: "배송을 수락했습니다." })
    setDeliveryState(null)
    setAcceptLoading(false)
    startTransition(() => router.refresh())
  })

  const handleDecline = ctx?.handleDecline ?? (async () => {
    if (!deliveryForActions) return
    if (supabaseRef.current) {
      await supabaseRef.current
        .from("notifications")
        .update({ is_read: true })
        .eq("id", deliveryForActions.notificationId)
    }
    setDeliveryState(null)
    startTransition(() => router.refresh())
  })

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
      {realtimeStatus === "error" && (
        <div className="list-item-card--dense fixed top-16 left-2 right-2 z-[90] border-amber-200/55 bg-amber-50/95 px-3 py-2 text-xs text-amber-800 shadow-[0_2px_12px_rgba(180,83,9,0.12)]">
          <strong>실시간 알림 연결 실패.</strong> 새 배송 요청 시 띵동/진동이 올 수 없습니다. PC에서 Supabase SQL 또는 관리자에게 문의하세요.
        </div>
      )}
      {notificationPermission === "default" && realtimeStatus !== "error" && mounted && typeof window !== "undefined" && "Notification" in window && (
        <div className="list-item-card--dense fixed top-16 left-2 right-2 z-[90] border-blue-200/55 bg-blue-50/95 px-3 py-2 text-xs text-blue-800 shadow-[0_2px_12px_rgba(37,99,235,0.12)] flex items-center justify-between gap-2">
          <span>다른 앱 사용 중에도 알림을 받으려면 알림을 허용해 주세요.</span>
          <Button type="button" size="sm" variant="secondary" className="shrink-0 text-xs" onClick={requestNotificationPermission}>
            알림 허용
          </Button>
        </div>
      )}
      {/* 컨텍스트 없을 때만 팝업(앱이 올라와 있을 때는 배송대기중 영역에서 인라인 표시) */}
      {showPopup && latestNewDelivery && (
        <div
          role="alertdialog"
          aria-labelledby="delivery-popup-title"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/35"
          onClick={handleDecline}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.15)] overflow-hidden animate-in zoom-in-95 duration-200"
            onPointerDown={onPopupInteraction}
            onTouchStart={onPopupInteraction}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-muted/30">
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
                <span className="text-muted-foreground truncate" title={latestNewDelivery.delivery.pickup_address}>
                  {toAddressAbbrev(latestNewDelivery.delivery.pickup_address)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 shrink-0 text-red-600" />
                <span className="text-muted-foreground truncate" title={latestNewDelivery.delivery.delivery_address}>
                  {toAddressAbbrev(latestNewDelivery.delivery.delivery_address)}
                </span>
              </div>
              {latestNewDelivery.delivery.item_description && (
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">
                    {({ document: "서류", small: "소형", medium: "중형", large: "대형" } as Record<string,string>)[latestNewDelivery.delivery.item_description] ?? latestNewDelivery.delivery.item_description}
                  </span>
                  {latestNewDelivery.delivery.package_size && (
                    <span className="text-muted-foreground text-xs">({latestNewDelivery.delivery.package_size})</span>
                  )}
                </div>
              )}
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
            <div className="flex gap-2 px-4 pb-4 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDecline}
                disabled={acceptLoading}
              >
                넘기기
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleAccept}
                disabled={acceptLoading}
              >
                {acceptLoading ? "처리 중…" : "수락하기"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

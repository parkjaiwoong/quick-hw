"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { acceptDelivery } from "@/lib/actions/driver"
import { useRouter } from "next/navigation"

interface DeliveryNotification {
  id: string
  delivery_id: string
  title: string
  message: string
  type: string
  created_at: string
}

export function RealtimeDeliveryNotifications({ userId }: { userId: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [userInteracted, setUserInteracted] = useState(false)
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

  // 소리 재생 함수 (Web Audio API 사용) - useCallback으로 메모이제이션
  const playNotificationSound = useCallback(() => {
    if (!userInteracted) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // 두 번의 beep 소리 (띵동 효과)
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

      playBeep(800, 0) // 첫 번째 beep
      playBeep(600, 200) // 두 번째 beep (200ms 후)
    } catch (error) {
      console.error("소리 재생 실패:", error)
    }
  }, [userInteracted])

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
              // 배송 정보 가져오기
              const { data: delivery, error: deliveryError } = await supabase
                .from("deliveries")
                .select("id, pickup_address, delivery_address, distance_km")
                .eq("id", notification.delivery_id)
                .single()

              if (deliveryError) {
                console.error("배송 정보 가져오기 실패:", deliveryError)
                return
              }

              if (delivery) {
              // 소리 재생
              playNotificationSound()

              // 토스트 알림 표시
              const notificationId = notification.id
              const deliveryId = notification.delivery_id

              // ref를 통해 최신 toast와 router 사용
              const currentToast = toastRef.current
              const currentRouter = routerRef.current

              currentToast({
                title: "📦 새로운 배송 요청",
                description: (
                  <div className="space-y-3 mt-2">
                    <div className="text-sm space-y-1">
                      <p className="font-semibold text-base">출발지</p>
                      <p className="text-muted-foreground">{delivery.pickup_address}</p>
                      <p className="font-semibold text-base mt-2">도착지</p>
                      <p className="text-muted-foreground">{delivery.delivery_address}</p>
                      {delivery.distance_km && (
                        <p className="text-muted-foreground text-xs mt-1">
                          거리: {delivery.distance_km.toFixed(1)}km
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={async () => {
                          const result = await acceptDelivery(deliveryId)
                          if (result.error) {
                            toastRef.current({
                              title: "오류",
                              description: result.error,
                              variant: "destructive",
                            })
                          } else {
                            // 알림 읽음 처리
                            await supabase
                              .from("notifications")
                              .update({ is_read: true })
                              .eq("id", notificationId)

                            toastRef.current({
                              title: "✅ 배송 수락 완료",
                              description: "배송을 수락했습니다.",
                            })
                            routerRef.current.refresh()
                          }
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        수락
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          // 알림 읽음 처리
                          await supabase
                            .from("notifications")
                            .update({ is_read: true })
                            .eq("id", notificationId)
                        }}
                        className="flex-1"
                      >
                        거절
                      </Button>
                    </div>
                  </div>
                ),
                duration: 15000, // 15초간 표시
                className: "w-full max-w-md border-blue-200 bg-blue-50",
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
  }, [userId, playNotificationSound])

  return null // UI는 toast로 표시되므로 렌더링할 것이 없음
}

"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface DeliveryTrackingMapProps {
  deliveryId: string
  delivery: any
}

export function DeliveryTrackingMap({ deliveryId, delivery }: DeliveryTrackingMapProps) {
  const [trackingData, setTrackingData] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()

    if (!supabase) {
      console.error("[v0] Supabase client not available for tracking")
      return
    }

    // 초기 추적 데이터 로드
    async function loadTracking() {
      try {
        const { data } = await supabase
          .from("delivery_tracking")
          .select("*")
          .eq("delivery_id", deliveryId)
          .order("created_at", { ascending: false })
          .limit(1)

        if (data) {
          setTrackingData(data)
        }
      } catch (error) {
        console.error("[v0] Error loading tracking data:", error)
      }
    }

    loadTracking()

    // 실시간 구독
    const channel = supabase
      .channel(`delivery-${deliveryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_tracking",
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload) => {
          console.log("[v0] New tracking update:", payload)
          setTrackingData([payload.new, ...trackingData.slice(0, 9)])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [deliveryId])

  return (
    <div className="space-y-4">
      <div className="bg-accent/50 rounded-lg p-8 text-center">
        <p className="text-muted-foreground mb-2">실시간 지도 추적</p>
        <p className="text-sm text-muted-foreground">
          실제 운영 시 카카오맵 API를 통합하여
          <br />
          배송원의 실시간 위치를 지도에 표시합니다
        </p>

        {trackingData.length > 0 && (
          <div className="mt-4 p-4 bg-background rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">최근 위치 업데이트</p>
            <p className="text-sm font-mono">{trackingData[0].location}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(trackingData[0].created_at).toLocaleString("ko-KR")}
            </p>
          </div>
        )}

        {delivery.status === "pending" && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">배송원이 배정되면 실시간 추적이 시작됩니다</p>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>💡 개발 참고사항:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>카카오맵 JavaScript API 연동 필요</li>
          <li>배송원 앱에서 GPS 위치 자동 전송 구현</li>
          <li>Supabase Realtime으로 실시간 업데이트 표시</li>
          <li>경로 최적화 및 예상 도착 시간 계산</li>
        </ul>
      </div>
    </div>
  )
}

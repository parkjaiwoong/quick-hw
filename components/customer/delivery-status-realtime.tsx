"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

/**
 * 배송 상태(deliveries) 변경 시 실시간 반영.
 * 기사 수락 등으로 status/driver_id가 바뀌면 router.refresh()로 배송 상세를 다시 불러옵니다.
 */
export function DeliveryStatusRealtime({ deliveryId }: { deliveryId: string }) {
  const router = useRouter()

  useEffect(() => {
    if (!deliveryId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`delivery-status:${deliveryId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deliveries",
          filter: `id=eq.${deliveryId}`,
        },
        () => {
          router.refresh()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [deliveryId, router])

  return null
}

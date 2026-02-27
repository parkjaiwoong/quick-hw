"use client"

import { useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

/**
 * 배송 상태(deliveries) 변경 시 실시간 반영.
 * - cancelled 상태: 고객 메인으로 이동
 * - 그 외 변경: router.refresh()로 배송 상세 갱신
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
        (payload) => {
          const newStatus = (payload.new as { status?: string })?.status
          if (newStatus === "cancelled") {
            router.push("/customer")
          } else {
            startTransition(() => router.refresh())
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [deliveryId, router])

  return null
}

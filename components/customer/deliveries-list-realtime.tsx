"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

/**
 * 고객 대시(내 배송 목록)에서 내 배송이 수락/픽업/배송중/완료 등으로 변경되면
 * 서버 데이터를 다시 가져와 목록·통계가 바로 반영되도록 구독.
 */
export function DeliveriesListRealtime({ customerId }: { customerId: string }) {
  const router = useRouter()

  useEffect(() => {
    if (!customerId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`customer-deliveries:${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deliveries",
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          router.refresh()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [customerId, router])

  return null
}

"use client"

import { useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

const STATUS_LABEL: Record<string, string> = {
  accepted: "수락됨",
  picked_up: "픽업완료",
  in_transit: "배송중",
  delivered: "완료",
  cancelled: "취소됨",
}

/**
 * 배송 상태(deliveries) 변경 시 실시간 반영.
 * - 상태 변경 시 토스트 알림: "배송 상태가 [상태]로 변경되었습니다"
 * - cancelled 상태: 고객 메인으로 이동
 * - 그 외 변경: router.refresh()로 배송 상세 갱신
 */
export function DeliveryStatusRealtime({ deliveryId }: { deliveryId: string }) {
  const router = useRouter()
  const { toast } = useToast()

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
          const oldStatus = (payload.old as { status?: string })?.status
          const newStatus = (payload.new as { status?: string })?.status
          if (newStatus && newStatus !== oldStatus) {
            const label = STATUS_LABEL[newStatus] ?? newStatus
            toast({
              title: "배송 상태 알림",
              description: `배송 상태가 ${label}(으)로 변경되었습니다.`,
              duration: 4000,
              className: "border-blue-200 bg-blue-50",
            })
          }
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
  }, [deliveryId, router, toast])

  return null
}

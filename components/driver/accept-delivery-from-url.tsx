"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { acceptDelivery } from "@/lib/actions/driver"

/** 앱 Full Screen Intent 배차 수락 후 ?accept_delivery=ID 로 들어온 경우 자동 수락 후 URL 정리 */
export function AcceptDeliveryFromUrl({ deliveryId }: { deliveryId: string | null }) {
  const router = useRouter()

  useEffect(() => {
    if (!deliveryId) return
    let cancelled = false
    acceptDelivery(deliveryId).then(() => {
      if (!cancelled) router.replace("/driver")
    }).catch(() => {
      if (!cancelled) router.replace("/driver")
    })
    return () => { cancelled = true }
  }, [deliveryId, router])

  return null
}

"use client"

import React, { createContext, useCallback, useContext, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { acceptDelivery } from "@/lib/actions/driver"
import { startTransition } from "react"

export interface LatestNewDelivery {
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

type ContextValue = {
  latestNewDelivery: LatestNewDelivery | null
  setLatestNewDelivery: (v: LatestNewDelivery | null) => void
  acceptLoading: boolean
  handleAccept: () => Promise<void>
  handleDecline: () => Promise<void>
}

const DriverDeliveryRequestContext = createContext<ContextValue | null>(null)

export function useDriverDeliveryRequest() {
  const ctx = useContext(DriverDeliveryRequestContext)
  return ctx
}

export function DriverDeliveryRequestProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const router = useRouter()
  const [latestNewDelivery, setLatestNewDelivery] = useState<LatestNewDelivery | null>(null)
  const [acceptLoading, setAcceptLoading] = useState(false)

  const handleAccept = useCallback(async () => {
    if (!latestNewDelivery || acceptLoading) return
    setAcceptLoading(true)
    const result = await acceptDelivery(latestNewDelivery.delivery.id)
    if (result.error) {
      toast({ title: "오류", description: result.error, variant: "destructive" })
      setAcceptLoading(false)
      return
    }
    const supabase = createClient()
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", latestNewDelivery.notificationId)
    toast({ title: "✅ 배송 수락 완료", description: "배송을 수락했습니다." })
    setLatestNewDelivery(null)
    setAcceptLoading(false)
    startTransition(() => router.refresh())
  }, [latestNewDelivery, acceptLoading, toast, router])

  const handleDecline = useCallback(async () => {
    if (!latestNewDelivery) return
    const supabase = createClient()
    await supabase.from("notifications").update({ is_read: true }).eq("id", latestNewDelivery.notificationId)
    setLatestNewDelivery(null)
    startTransition(() => router.refresh())
  }, [latestNewDelivery, router])

  const value: ContextValue = {
    latestNewDelivery,
    setLatestNewDelivery,
    acceptLoading,
    handleAccept,
    handleDecline,
  }

  return (
    <DriverDeliveryRequestContext.Provider value={value}>
      {children}
    </DriverDeliveryRequestContext.Provider>
  )
}

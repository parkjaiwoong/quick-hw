"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CreditCard } from "lucide-react"

interface PayWithBillingButtonProps {
  orderId: string
  deliveryId: string
  disabled?: boolean
}

export function PayWithBillingButton({ orderId, deliveryId, disabled }: PayWithBillingButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    if (disabled || loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/payments/pay-with-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "등록 카드 결제에 실패했습니다.")
        return
      }
      toast.success("결제가 완료되었습니다.")
      router.push(`/customer/delivery/${data.deliveryId ?? deliveryId}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "결제 요청에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      onClick={handlePay}
      disabled={disabled || loading}
    >
      <CreditCard className="mr-2 h-4 w-4" />
      {loading ? "결제 처리 중…" : "등록된 카드로 결제"}
    </Button>
  )
}

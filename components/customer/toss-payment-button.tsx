"use client"

import { useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment: (method: "CARD", options: Record<string, any>) => Promise<void>
    }
  }
}

interface TossPaymentButtonProps {
  orderId: string
  amount: number
  disabled?: boolean
  /** 기사 연결 요청 후 이동 시 토스 결제 창 자동 오픈 */
  autoPay?: boolean
}

export function TossPaymentButton({ orderId, amount, disabled, autoPay }: TossPaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const autoPayTriggered = useRef(false)

  useEffect(() => {
    if (document.querySelector("script[data-toss-payments]")) {
      return
    }
    const script = document.createElement("script")
    script.src = "https://js.tosspayments.com/v1/payment"
    script.async = true
    script.dataset.tossPayments = "true"
    document.body.appendChild(script)
  }, [])

  const handleClick = async () => {
    if (disabled || isLoading) return
    setIsLoading(true)
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amount }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(payload?.error || "결제 요청에 실패했습니다.")
        return
      }
      if (!window.TossPayments) {
        toast.error("결제 모듈을 불러오지 못했습니다.")
        return
      }

      const toss = window.TossPayments(payload.clientKey)
      await toss.requestPayment("CARD", {
        amount: payload.amount,
        orderId: payload.orderId,
        orderName: payload.orderName,
        customerName: payload.customerName,
        successUrl: payload.successUrl,
        failUrl: payload.failUrl,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "결제 요청에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  // 기사 연결 후 ?pay=1로 들어온 경우: 토스 스크립트 로드 후 결제 창 자동 오픈
  useEffect(() => {
    if (!autoPay || disabled || autoPayTriggered.current) return
    autoPayTriggered.current = true
    const waitForScript = (attempts = 0) => {
      if (window.TossPayments) {
        setTimeout(() => handleClick(), 300)
        return
      }
      if (attempts < 25) setTimeout(() => waitForScript(attempts + 1), 200)
    }
    const t = setTimeout(() => waitForScript(), 500)
    return () => clearTimeout(t)
  }, [autoPay, disabled])

  return (
    <Button type="button" onClick={handleClick} disabled={disabled || isLoading} className="w-full">
      {isLoading ? "결제 처리중..." : "결제하기"}
    </Button>
  )
}

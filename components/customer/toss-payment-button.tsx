"use client"

import { useEffect, useState, useRef, useCallback } from "react"
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
  const [scriptReady, setScriptReady] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [payFromUrl, setPayFromUrl] = useState(false)
  const autoPayTriggered = useRef(false)

  const shouldAutoPay = Boolean(autoPay || payFromUrl)

  useEffect(() => {
    if (typeof window === "undefined") return
    const pay = new URLSearchParams(window.location.search).get("pay")
    if (pay === "1") setPayFromUrl(true)
  }, [])

  useEffect(() => {
    const existing = document.querySelector("script[data-toss-payments]")
    if (existing) {
      if (window.TossPayments) {
        setScriptReady(true)
        return
      }
      const check = setInterval(() => {
        if (window.TossPayments) {
          setScriptReady(true)
          clearInterval(check)
        }
      }, 200)
      return () => clearInterval(check)
    }
    const script = document.createElement("script")
    script.src = "https://js.tosspayments.com/v1/payment"
    script.async = true
    script.dataset.tossPayments = "true"
    script.onload = () => setScriptReady(true)
    script.onerror = () => setErrorMsg("결제 스크립트를 불러오지 못했습니다.")
    document.body.appendChild(script)
  }, [])

  const showError = useCallback((message: string) => {
    setErrorMsg(message)
    toast.error(message)
  }, [])

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return
    if (!scriptReady || !window.TossPayments) {
      showError("결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.")
      return
    }
    setErrorMsg(null)
    setIsLoading(true)
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amount }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const msg = payload?.error || "결제 요청에 실패했습니다."
        showError(msg)
        return
      }
      if (!window.TossPayments) {
        showError("결제 모듈을 불러오지 못했습니다.")
        return
      }

      const toss = window.TossPayments(payload.clientKey)
      const payPromise = toss.requestPayment("CARD", {
        amount: payload.amount,
        orderId: payload.orderId,
        orderName: payload.orderName,
        customerName: payload.customerName,
        successUrl: payload.successUrl,
        failUrl: payload.failUrl,
      })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("결제 창이 열리지 않았습니다. 팝업 차단을 해제한 뒤 다시 시도해 주세요.")), 15000)
      await Promise.race([payPromise, timeout])
    } catch (error) {
      const msg = error instanceof Error ? error.message : "결제 요청에 실패했습니다."
      showError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [orderId, amount, disabled, isLoading, scriptReady, showError])

  useEffect(() => {
    if (!shouldAutoPay || disabled || autoPayTriggered.current || !scriptReady) return
    autoPayTriggered.current = true
    handleClick()
  }, [shouldAutoPay, disabled, scriptReady, handleClick])

  const buttonDisabled = disabled || isLoading || !scriptReady
  const buttonLabel = !scriptReady ? "준비 중..." : isLoading ? "결제 처리중..." : "결제하기"

  return (
    <div className="space-y-2 w-full">
      <Button
        type="button"
        onClick={handleClick}
        disabled={buttonDisabled}
        className="w-full"
        aria-busy={isLoading}
      >
        {buttonLabel}
      </Button>
      {errorMsg && (
        <p className="text-sm text-destructive text-center" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  )
}

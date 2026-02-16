"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CreditCard } from "lucide-react"

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestBillingAuth: (method: "카드", options: {
        customerKey: string
        successUrl: string
        failUrl: string
      }) => Promise<void>
    }
  }
}

interface BillingAuthButtonProps {
  customerKey: string
  successUrl: string
  failUrl: string
  clientKey: string
  disabled?: boolean
}

export function BillingAuthButton({
  customerKey,
  successUrl,
  failUrl,
  clientKey,
  disabled,
}: BillingAuthButtonProps) {
  const [loading, setLoading] = useState(false)
  const [scriptReady, setScriptReady] = useState(false)

  useEffect(() => {
    if (document.querySelector("script[data-toss-payments]")) {
      setScriptReady(!!window.TossPayments)
      return
    }
    const script = document.createElement("script")
    script.src = "https://js.tosspayments.com/v1/payment"
    script.async = true
    script.dataset.tossPayments = "true"
    script.onload = () => setScriptReady(true)
    document.body.appendChild(script)
  }, [])

  const handleRegister = async () => {
    if (!window.TossPayments || !customerKey || !successUrl || !failUrl || loading) return
    setLoading(true)
    try {
      const toss = window.TossPayments(clientKey)
      await toss.requestBillingAuth("카드", { customerKey, successUrl, failUrl })
    } catch (e) {
      if ((e as { code?: string })?.code !== "USER_CANCEL") {
        console.error(e)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleRegister}
      disabled={disabled || !scriptReady || loading}
    >
      <CreditCard className="mr-2 h-4 w-4" />
      {loading ? "카드 등록창 여는 중…" : scriptReady ? "카드 등록 (토스 결제창)" : "로딩 중…"}
    </Button>
  )
}

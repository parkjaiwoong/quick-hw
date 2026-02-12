"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type PaymentStatus = "loading" | "success" | "error"

export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const confirmRequested = useRef(false)
  const [status, setStatus] = useState<PaymentStatus>("loading")

  useEffect(() => {
    if (confirmRequested.current) return
    confirmRequested.current = true

    const paymentKey = searchParams.get("paymentKey")
    const orderId = searchParams.get("orderId")
    const amountValue = searchParams.get("amount")
    const amount = Number(amountValue || 0)

    if (!paymentKey || !orderId || !amount) {
      setStatus("error")
      return
    }

    const confirmPayment = async () => {
      const response = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      })
      if (!response.ok) {
        setStatus("error")
        return
      }
      const payload = await response.json().catch(() => null)
      setStatus(payload?.success === true ? "success" : "error")
    }

    confirmPayment().catch(() => setStatus("error"))
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-lg mx-auto flex min-h-[70vh] items-center">
        <Card className="w-full">
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <CardTitle className="mt-2">
              {status === "loading"
                ? "결제 승인 처리중입니다..."
                : status === "success"
                  ? "결제가 완료되었습니다"
                  : "결제가 실패했습니다"}
            </CardTitle>
            <CardDescription>
              {status === "success"
                ? "결제가 정상적으로 처리되었습니다."
                : status === "error"
                  ? "결제 승인에 실패했습니다."
                  : "결제 승인 요청을 처리하고 있습니다."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {status === "error" ? (
              <Button onClick={() => router.back()}>다시 결제하기</Button>
            ) : (
              <Button onClick={() => router.back()}>주문 내역으로 돌아가기</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

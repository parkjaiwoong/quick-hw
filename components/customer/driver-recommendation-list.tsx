"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Truck, Shield, Phone, CheckCircle } from "lucide-react"
import { requestDriverConnection } from "@/lib/actions/deliveries"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"

interface Driver {
  id: string
  full_name: string
  vehicle_type: string
  rating: number
  total_deliveries: number
  is_available: boolean
  distance_km: number
  has_insurance: boolean
}

interface DriverRecommendationListProps {
  drivers: Driver[]
  deliveryId: string
  /** 카드 결제 시 연결 요청 성공 후 바로 토스 결제 창 띄우기 */
  openTossAfterConnect?: boolean
  orderId?: string
  paymentAmount?: number
}

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment: (method: "CARD", options: Record<string, unknown>) => Promise<void>
    }
  }
}

export function DriverRecommendationList({
  drivers,
  deliveryId,
  openTossAfterConnect,
  orderId,
  paymentAmount = 0,
}: DriverRecommendationListProps) {
  const router = useRouter()
  const [loadingDriverId, setLoadingDriverId] = useState<string | null>(null)
  const [connectedDriverId, setConnectedDriverId] = useState<string | null>(null)
  const [paymentOpening, setPaymentOpening] = useState(false)

  useEffect(() => {
    if (document.querySelector("script[data-toss-payments]")) return
    const script = document.createElement("script")
    script.src = "https://js.tosspayments.com/v1/payment"
    script.async = true
    script.dataset.tossPayments = "true"
    document.body.appendChild(script)
  }, [])

  async function openTossPayment() {
    if (!orderId || paymentAmount <= 0 || !window.TossPayments) return
    setPaymentOpening(true)
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amount: paymentAmount }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
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
      // 결제 완료 시 successUrl로 이동하므로 여기서는 팝업 닫힌 경우만 옴(취소 등)
      toast.info("결제를 완료하면 배송 상세에서 확인할 수 있습니다.")
      router.push(`/customer/delivery/${deliveryId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "결제 요청에 실패했습니다.")
      router.push(`/customer/delivery/${deliveryId}`)
    } finally {
      setPaymentOpening(false)
    }
  }

  async function handleConnectRequest(driverId: string) {
    setLoadingDriverId(driverId)

    const result = await requestDriverConnection(deliveryId, driverId)

    if (result.error) {
      toast.error(result.error)
      setLoadingDriverId(null)
    } else {
      setLoadingDriverId(null)
      setConnectedDriverId(driverId)
      if (openTossAfterConnect && orderId && paymentAmount > 0) {
        toast.success("연결 요청되었습니다. 결제 창을 엽니다.")
        const waitToss = (attempts: number) => {
          if (window.TossPayments) {
            openTossPayment()
            return
          }
          if (attempts < 30) setTimeout(() => waitToss(attempts + 1), 200)
          else {
            toast.error("결제 모듈 로딩이 지연됩니다. 배송 상세에서 결제해 주세요.")
            router.push(`/customer/delivery/${deliveryId}`)
          }
        }
        setTimeout(() => waitToss(0), 400)
      } else {
        toast.success("연결 요청되었습니다. 배송 상세에서 진행 상황을 확인하세요.")
        router.push(`/customer/delivery/${deliveryId}`)
      }
    }
  }

  return (
    <div className="space-y-4">
      {drivers.map((driver) => (
        <Card key={driver.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {driver.full_name || "기사"}
                  {driver.has_insurance && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <Shield className="h-3 w-3 mr-1" />
                      보험 가입
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  거리: {driver.distance_km?.toFixed(1) || "0"}km
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">평점</div>
                <div className="text-lg font-bold">{driver.rating?.toFixed(1) || "5.0"}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>{driver.vehicle_type || "일반"}</span>
                </div>
                <div className="text-muted-foreground">
                  운행 {driver.total_deliveries || 0}건
                </div>
              </div>

              {connectedDriverId === driver.id ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    연결 요청이 전송되었습니다! 기사가 수락하면 연락처가 공개됩니다.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  onClick={() => handleConnectRequest(driver.id)}
                  disabled={loadingDriverId !== null || !driver.is_available}
                  className="w-full"
                >
                  {loadingDriverId === driver.id ? (
                    "요청 중..."
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      연결 요청
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}


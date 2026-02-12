"use client"

import type { Delivery } from "@/lib/types/database"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Bike, Clock, Calendar, Zap } from "lucide-react"

interface AvailableDeliveriesProps {
  deliveries: Delivery[]
}

export function AvailableDeliveries({ deliveries }: AvailableDeliveriesProps) {
  const router = useRouter()

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">현재 대기 중인 배송 요청이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          배송을 수락하면 고객 연락처가 공개됩니다. 요금은 카카오픽 기준으로 자동 산정됩니다.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <div className="grid grid-cols-12 text-xs font-semibold text-muted-foreground px-3">
          <div className="col-span-2">구분</div>
          <div className="col-span-2">거리</div>
          <div className="col-span-3">픽업</div>
          <div className="col-span-3">배송</div>
          <div className="col-span-2 text-right">확정 금액</div>
        </div>
        {deliveries.map((delivery) => {
          const displayFee = delivery.driver_fee ?? delivery.total_fee ?? 0
          const priceLabel = `${Number(displayFee).toLocaleString()}원`
          const isScheduled = delivery.delivery_option === "scheduled"
          const isExpress = delivery.urgency === "express"
          const vehicle = delivery.vehicle_type === "motorcycle" ? "오토바이" : delivery.vehicle_type || "오토바이"

          return (
            <div
              key={delivery.id}
              className="grid grid-cols-12 items-center gap-2 rounded-lg border bg-card px-3 py-3 text-sm hover:bg-accent/30 cursor-pointer"
              onDoubleClick={() => router.push(`/driver/delivery/${delivery.id}`)}
              title="더블클릭으로 상세 보기"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  router.push(`/driver/delivery/${delivery.id}`)
                }
              }}
            >
              <div className="col-span-2 flex items-center gap-1 flex-wrap">
                <Bike className="h-4 w-4 text-muted-foreground" title={vehicle} />
                {isScheduled ? (
                  <Calendar className="h-4 w-4 text-amber-600" title="예약 픽업" />
                ) : isExpress ? (
                  <Zap className="h-4 w-4 text-orange-500" title="급송" />
                ) : (
                  <Clock className="h-4 w-4 text-blue-600" title="즉시 픽업" />
                )}
              </div>
              <div className="col-span-2 font-semibold">{delivery.distance_km?.toFixed(1) || "0"}km</div>
              <div className="col-span-3 truncate">{delivery.pickup_address}</div>
              <div className="col-span-3 truncate">{delivery.delivery_address}</div>
              <div className="col-span-2 text-right font-semibold">{priceLabel}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

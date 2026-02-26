"use client"

import type { Delivery } from "@/lib/types/database"
import { useRouter } from "next/navigation"
import { AlertCircle, Bike, Clock, Calendar, Zap, MapPin } from "lucide-react"
import { useDriverDeliveryRequest } from "@/lib/contexts/driver-delivery-request"
import { Button } from "@/components/ui/button"

function shortenAddress(addr: string, maxLen: number) {
  if (!addr || addr.length <= maxLen) return addr
  return addr.slice(0, maxLen) + "…"
}

interface AvailableDeliveriesProps {
  deliveries: Delivery[]
}

export function AvailableDeliveries({ deliveries }: AvailableDeliveriesProps) {
  const router = useRouter()
  const ctx = useDriverDeliveryRequest()
  const latestNew = ctx?.latestNewDelivery ?? null

  const emptyAndNoNew = deliveries.length === 0 && !latestNew
  if (emptyAndNoNew) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">현재 대기 중인 배송 요청이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 배송대기중: 새 요청이 있으면 확장 카드(픽업/배송 주소, 금액, 수락하기만), 없으면 문구만 */}
      {latestNew && ctx ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 border-b border-blue-200/60">
            <AlertCircle className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="text-blue-800 font-medium">배송대기중</span>
          </div>
          <div className="px-4 py-3 space-y-2 bg-white/70">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-green-600" />
              <span className="text-muted-foreground truncate">{shortenAddress(latestNew.delivery.pickup_address, 32)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-red-600" />
              <span className="text-muted-foreground truncate">{shortenAddress(latestNew.delivery.delivery_address, 32)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-muted-foreground">
                {latestNew.delivery.distance_km != null && `${latestNew.delivery.distance_km.toFixed(1)}km`}
                {(latestNew.delivery.driver_fee ?? latestNew.delivery.total_fee) != null && (
                  <span className="ml-2 font-semibold text-foreground">
                    {Number(latestNew.delivery.driver_fee ?? latestNew.delivery.total_fee).toLocaleString()}원
                  </span>
                )}
              </span>
            </div>
            <div className="pt-2">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={ctx.handleAccept}
                disabled={ctx.acceptLoading}
              >
                {ctx.acceptLoading ? "처리 중…" : "수락하기"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="text-blue-800 font-medium">배송대기중</span>
        </div>
      )}

      {deliveries.length > 0 && (
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
              <div className="col-span-2 flex items-center gap-1 flex-wrap" title={vehicle}>
                <Bike className="h-4 w-4 text-muted-foreground" />
                {isScheduled ? (
                  <Calendar className="h-4 w-4 text-amber-600" aria-hidden />
                ) : isExpress ? (
                  <Zap className="h-4 w-4 text-orange-500" aria-hidden />
                ) : (
                  <Clock className="h-4 w-4 text-blue-600" aria-hidden />
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
      )}
    </div>
  )
}

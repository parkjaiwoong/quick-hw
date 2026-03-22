"use client"

import type { Delivery } from "@/lib/types/database"

type DeliveryWithPickupDist = Delivery & { pickup_distance_km?: number | null }
import { useRouter } from "next/navigation"
import { AlertCircle, Bike, Clock, Calendar, Zap, MapPin } from "lucide-react"
import { useDriverDeliveryRequest } from "@/lib/contexts/driver-delivery-request"
import { Button } from "@/components/ui/button"
import { toDongOnly } from "@/lib/address-abbrev"

/** 1km 미만이면 m, 이상이면 km 표시 */
function formatDistance(km: number | null | undefined): string {
  if (km == null) return ""
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

interface AvailableDeliveriesProps {
  deliveries: DeliveryWithPickupDist[]
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
    <div className="space-y-2">
      {/* 배송대기중: 새 요청이 있으면 확장 카드(픽업/배송 주소, 금액, 수락하기만), 없으면 문구만 */}
      {latestNew && ctx ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
          <div className="px-2 py-2 flex items-center gap-2 border-b border-blue-200/60">
            <AlertCircle className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="text-blue-800 font-medium">배송대기중</span>
          </div>
          <div className="px-2 py-2 space-y-1.5 bg-white/70">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-green-600" />
              <span className="text-muted-foreground truncate" title={latestNew.delivery.pickup_address}>
                {toDongOnly(latestNew.delivery.pickup_address)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-red-600" />
              <span className="text-muted-foreground truncate" title={latestNew.delivery.delivery_address}>
                {toDongOnly(latestNew.delivery.delivery_address)}
              </span>
            </div>
            {latestNew.delivery.item_description && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">물품:</span>
                <span className="font-medium">
                  {({ document: "서류", small: "소형", medium: "중형", large: "대형" } as Record<string,string>)[latestNew.delivery.item_description] ?? latestNew.delivery.item_description}
                </span>
                {latestNew.delivery.package_size && (
                  <span className="text-muted-foreground text-xs">({latestNew.delivery.package_size})</span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-muted-foreground">
                {latestNew.delivery.distance_km != null && formatDistance(latestNew.delivery.distance_km)}
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
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="text-blue-800 font-medium">배송대기중</span>
        </div>
      )}

      {deliveries.length > 0 && (
      <div className="space-y-1 w-full min-w-0">
        {/* 작은 헤더: 픽업 위 구분·거리, 배송 위 픽업→배송 거리 */}
        <div className="grid grid-cols-[1fr_1fr_minmax(5rem,auto)] text-[10px] text-muted-foreground gap-1 w-full min-w-0">
          <div className="flex gap-3">
            <span>구분</span>
            <span>거리</span>
          </div>
          <div>픽업→배송 거리</div>
          <div className="min-w-[5rem]" aria-hidden />
        </div>
        {/* 메인 헤더: 픽업, 배송, 확정 금액 (찐하게) */}
        <div className="grid grid-cols-[1fr_1fr_minmax(5rem,auto)] text-sm font-bold text-foreground gap-1 w-full min-w-0">
          <div>픽업</div>
          <div>배송</div>
          <div className="text-right min-w-[5rem]">확정 금액</div>
        </div>
        {deliveries.map((delivery) => {
          const displayFee = delivery.driver_fee ?? delivery.total_fee ?? 0
          const priceLabel = `${Number(displayFee).toLocaleString()}원`
          const isScheduled = delivery.delivery_option === "scheduled"
          const isExpress = delivery.urgency === "express"
          const vehicle = delivery.vehicle_type === "motorcycle" ? "오토바이" : delivery.vehicle_type || "오토바이"
          const pickupDistStr =
            delivery.pickup_distance_km != null ? formatDistance(delivery.pickup_distance_km) : null
          const deliveryDistStr = formatDistance(delivery.distance_km ?? 0)

          return (
            <div
              key={delivery.id}
              className="grid grid-cols-[1fr_1fr_minmax(5rem,auto)] items-center gap-1 rounded border bg-card px-1 py-2 text-sm hover:bg-accent/30 cursor-pointer w-full min-w-0"
              onClick={() => router.push(`/driver/delivery/${delivery.id}`)}
              title="클릭으로 상세 보기"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  router.push(`/driver/delivery/${delivery.id}`)
                }
              }}
            >
              <div className="min-w-0 flex items-center gap-2">
                <div className="flex items-center gap-0.5 shrink-0 text-muted-foreground" title={vehicle}>
                  <Bike className="h-3.5 w-3.5" />
                  {isScheduled ? (
                    <Calendar className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                  ) : isExpress ? (
                    <Zap className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                  )}
                </div>
                {pickupDistStr != null && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{pickupDistStr}</span>
                )}
                <span className="truncate font-medium" title={delivery.pickup_address}>
                  {toDongOnly(delivery.pickup_address)}
                </span>
              </div>
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground shrink-0">{deliveryDistStr}</span>
                <span className="truncate font-medium" title={delivery.delivery_address}>
                  {toDongOnly(delivery.delivery_address)}
                </span>
              </div>
              <div className="text-right font-semibold min-w-[5rem] shrink-0">{priceLabel}</div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}

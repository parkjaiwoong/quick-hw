"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DeliveryTrackingMap } from "@/components/tracking/delivery-tracking-map"

type Delivery = {
  id: string
  status?: string
  created_at?: string
  pickup_address?: string
  delivery_address?: string
  pickup_location?: unknown
  delivery_location?: unknown
  driver_fee?: number | null
  total_fee?: number | null
  [k: string]: unknown
}

type Payment = { status?: string } | null
type Settlement = { settlement_status?: string } | null

export function LateDeliveryInfoDialog({
  delivery,
  payment,
  settlement,
}: {
  delivery: Delivery
  payment?: Payment
  settlement?: Settlement
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          정보 보기
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>배송 상세 정보</DialogTitle>
          <DialogDescription>결제/정산·기사 정산 금액 및 실시간 위치를 확인합니다</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">실시간 위치</CardTitle>
              <CardDescription>배송원의 현재 위치를 확인할 수 있습니다</CardDescription>
            </CardHeader>
            <CardContent>
              <DeliveryTrackingMap deliveryId={delivery.id} delivery={delivery} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">결제 · 정산 요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">기사 배정 금액</span>
                <span className="font-semibold">
                  {Number(delivery.driver_fee ?? 0).toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">결제 상태</span>
                <span className="font-medium">{payment?.status ?? "없음"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">정산 상태</span>
                <span className="font-medium">{settlement?.settlement_status ?? "없음"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}

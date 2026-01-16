"use client"

import type { Delivery } from "@/lib/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Package } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import Link from "next/link"

interface DeliveryListProps {
  deliveries: Delivery[]
}

const statusConfig = {
  pending: { label: "대기중", color: "bg-yellow-100 text-yellow-800" },
  accepted: { label: "수락됨", color: "bg-blue-100 text-blue-800" },
  picked_up: { label: "픽업완료", color: "bg-indigo-100 text-indigo-800" },
  in_transit: { label: "배송중", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "완료", color: "bg-green-100 text-green-800" },
  cancelled: { label: "취소됨", color: "bg-gray-100 text-gray-800" },
}

export function DeliveryList({ deliveries }: DeliveryListProps) {
  if (deliveries.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">배송 내역이 없습니다</h3>
        <p className="text-sm text-muted-foreground mt-2">첫 배송을 요청해보세요</p>
        <Button asChild className="mt-4">
          <Link href="/customer/new-delivery">배송 요청하기</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {deliveries.map((delivery) => (
        <div key={delivery.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={statusConfig[delivery.status].color}>{statusConfig[delivery.status].label}</Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true, locale: ko })}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">출발지</p>
                    <p className="text-muted-foreground">{delivery.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">도착지</p>
                    <p className="text-muted-foreground">{delivery.delivery_address}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{delivery.total_fee.toLocaleString()}원</p>
              <p className="text-xs text-muted-foreground">{delivery.distance_km?.toFixed(1)}km</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1 bg-transparent">
              <Link href={`/customer/delivery/${delivery.id}`}>상세보기</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

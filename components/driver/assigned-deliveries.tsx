"use client"

import type { Delivery } from "@/lib/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Phone } from "lucide-react"
import { updateDeliveryStatus } from "@/lib/actions/driver"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"

interface AssignedDeliveriesProps {
  deliveries: Delivery[]
}

const statusConfig = {
  accepted: { label: "수락됨", color: "bg-blue-100 text-blue-800", next: "picked_up", nextLabel: "픽업 완료" },
  picked_up: { label: "픽업완료", color: "bg-indigo-100 text-indigo-800", next: "in_transit", nextLabel: "배송 시작" },
  in_transit: { label: "배송중", color: "bg-purple-100 text-purple-800", next: "delivered", nextLabel: "배송 완료" },
}

export function AssignedDeliveries({ deliveries }: AssignedDeliveriesProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleUpdateStatus(deliveryId: string, newStatus: string) {
    setLoadingId(deliveryId)
    const result = await updateDeliveryStatus(deliveryId, newStatus)

    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }

    setLoadingId(null)
  }

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">진행 중인 배송이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {deliveries.map((delivery) => {
        const config = statusConfig[delivery.status as keyof typeof statusConfig]

        return (
          <div key={delivery.id} className="border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between mb-3">
              <Badge className={config.color}>{config.label}</Badge>
              <div className="text-right">
                <p className="text-xl font-bold text-green-600">{delivery.driver_fee?.toLocaleString()}원</p>
                <p className="text-xs text-muted-foreground">{delivery.distance_km?.toFixed(1)}km</p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">픽업 위치</p>
                    <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">{delivery.pickup_contact_name}</span>
                  <a href={`tel:${delivery.pickup_contact_phone}`} className="text-primary hover:underline">
                    {delivery.pickup_contact_phone}
                  </a>
                </div>
                {delivery.pickup_notes && (
                  <p className="text-xs text-muted-foreground mt-2">메모: {delivery.pickup_notes}</p>
                )}
              </div>

              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">배송 위치</p>
                    <p className="text-sm text-muted-foreground">{delivery.delivery_address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-red-600" />
                  <span className="font-medium">{delivery.delivery_contact_name}</span>
                  <a href={`tel:${delivery.delivery_contact_phone}`} className="text-primary hover:underline">
                    {delivery.delivery_contact_phone}
                  </a>
                </div>
                {delivery.delivery_notes && (
                  <p className="text-xs text-muted-foreground mt-2">메모: {delivery.delivery_notes}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1 bg-transparent">
                <Link href={`/driver/delivery/${delivery.id}`}>상세보기</Link>
              </Button>
              <Button
                onClick={() => handleUpdateStatus(delivery.id, config.next)}
                disabled={loadingId === delivery.id}
                size="sm"
                className="flex-1"
              >
                {loadingId === delivery.id ? "처리중..." : config.nextLabel}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

"use client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, FileText } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { createTaxInvoice } from "@/lib/actions/admin"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface AdminDeliveryListProps {
  deliveries: any[]
}

const statusConfig = {
  pending: { label: "대기중", color: "bg-yellow-100 text-yellow-800" },
  accepted: { label: "수락됨", color: "bg-blue-100 text-blue-800" },
  picked_up: { label: "픽업완료", color: "bg-indigo-100 text-indigo-800" },
  in_transit: { label: "배송중", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "완료", color: "bg-green-100 text-green-800" },
  cancelled: { label: "취소됨", color: "bg-gray-100 text-gray-800" },
}

export function AdminDeliveryList({ deliveries }: AdminDeliveryListProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleCreateInvoice(deliveryId: string) {
    if (!confirm("세금계산서를 발행하시겠습니까?")) return

    setLoadingId(deliveryId)
    const result = await createTaxInvoice(deliveryId)

    if (result.error) {
      alert(result.error)
    } else {
      alert("세금계산서가 발행되었습니다")
      router.refresh()
    }

    setLoadingId(null)
  }

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">배송 내역이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto">
      {deliveries.map((delivery) => (
        <div key={delivery.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className={statusConfig[delivery.status].color}>{statusConfig[delivery.status].label}</Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true, locale: ko })}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-3">
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

                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">고객</span>
                    <span className="font-medium">{delivery.customer?.full_name || "알 수 없음"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">배송원</span>
                    <span className="font-medium">{delivery.driver?.full_name || "미배정"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">거리</span>
                    <span className="font-medium">{delivery.distance_km?.toFixed(1)}km</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">총액</p>
                <p className="text-xl font-bold">{delivery.total_fee.toLocaleString()}원</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">플랫폼 수익</p>
                <p className="text-lg font-semibold text-green-600">{delivery.platform_fee?.toLocaleString() || 0}원</p>
              </div>
              {delivery.status === "delivered" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateInvoice(delivery.id)}
                  disabled={loadingId === delivery.id}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {loadingId === delivery.id ? "발행중..." : "세금계산서"}
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

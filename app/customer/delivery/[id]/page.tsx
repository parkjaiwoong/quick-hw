import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDeliveryForCustomer } from "@/lib/actions/tracking"
import { DeliveryTrackingMap } from "@/components/tracking/delivery-tracking-map"
import { DeliveryStatusTimeline } from "@/components/tracking/delivery-status-timeline"
import { Badge } from "@/components/ui/badge"
import { MapPin, Phone, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getOrderPaymentSummaryByDelivery } from "@/lib/actions/finance"

const statusConfig = {
  pending: { label: "대기중", color: "bg-yellow-100 text-yellow-800" },
  accepted: { label: "수락됨", color: "bg-blue-100 text-blue-800" },
  picked_up: { label: "픽업완료", color: "bg-indigo-100 text-indigo-800" },
  in_transit: { label: "배송중", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "완료", color: "bg-green-100 text-green-800" },
  cancelled: { label: "취소됨", color: "bg-gray-100 text-gray-800" },
}

const paymentStatusLabel: Record<string, string> = {
  PENDING: "결제 대기",
  PAID: "결제 완료",
  CANCELED: "결제 취소",
  REFUNDED: "환불 완료",
}

export default async function DeliveryDetailPage({ params }: { params: { id: string } }) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { id } = await params
  const { delivery } = await getDeliveryForCustomer(id)
  const { order, payment } = await getOrderPaymentSummaryByDelivery(id)

  if (!delivery || delivery.customer_id !== user.id) {
    redirect("/customer")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>메인 화면 이동</CardTitle>
            <CardDescription>역할별 메인 화면으로 바로 이동합니다</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/customer">고객 메인</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/driver">기사 메인</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/admin">관리자 메인</Link>
            </Button>
          </CardContent>
        </Card>
        <div className="flex items-center gap-4">
          <Button asChild variant="outline">
            <Link href="/customer">← 돌아가기</Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">배송 추적</h1>
            <p className="text-sm text-muted-foreground">실시간으로 배송 상태를 확인하세요</p>
          </div>
          <Badge className={statusConfig[delivery.status].color}>{statusConfig[delivery.status].label}</Badge>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>실시간 위치</CardTitle>
              <CardDescription>배송원의 현재 위치를 확인할 수 있습니다</CardDescription>
            </CardHeader>
            <CardContent>
              <DeliveryTrackingMap deliveryId={delivery.id} delivery={delivery} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>배송 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold">픽업 위치</p>
                      <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <Phone className="h-4 w-4" />
                        <span>{delivery.pickup_contact_name}</span>
                        <span className="text-primary">{delivery.pickup_contact_phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold">배송 위치</p>
                      <p className="text-sm text-muted-foreground">{delivery.delivery_address}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <Phone className="h-4 w-4" />
                        <span>{delivery.delivery_contact_name}</span>
                        <span className="text-primary">{delivery.delivery_contact_phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {delivery.item_description && (
                  <div className="flex items-center gap-2 p-4 bg-accent/50 rounded-lg">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">물품 정보</p>
                      <p className="text-sm text-muted-foreground">{delivery.item_description}</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">거리</span>
                    <span className="font-semibold">{delivery.distance_km?.toFixed(1)}km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">배송비</span>
                    <span className="text-xl font-bold">{delivery.total_fee.toLocaleString()}원</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>결제 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">결제 수단</span>
                  <span className="font-medium">{payment?.payment_method || order?.payment_method || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">결제 금액</span>
                  <span className="font-semibold">{(payment?.amount || order?.order_amount || 0).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">결제 상태</span>
                  <span className="font-medium">{payment?.status ? paymentStatusLabel[payment.status] || payment.status : "-"}</span>
                </div>
              </CardContent>
            </Card>

            {delivery.driver && (
              <Card>
                <CardHeader>
                  <CardTitle>배송원 정보</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{delivery.driver.full_name}</p>
                      <p className="text-sm text-muted-foreground">{delivery.driver.phone}</p>
                    </div>
                    <Button asChild>
                      <a href={`tel:${delivery.driver.phone}`}>전화하기</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>배송 진행 상황</CardTitle>
            <CardDescription>배송의 각 단계별 상태를 확인하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <DeliveryStatusTimeline delivery={delivery} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

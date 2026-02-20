import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDeliveryForCustomer } from "@/lib/actions/tracking"
import { getRecommendedDriversForDelivery } from "@/lib/actions/deliveries"
import { DeliveryStatusTimeline } from "@/components/tracking/delivery-status-timeline"
import { DriverRecommendationList } from "@/components/customer/driver-recommendation-list"
import { Badge } from "@/components/ui/badge"
import { MapPin, Phone, Package, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getOrderPaymentSummaryByDelivery } from "@/lib/actions/finance"
import { TossPaymentButton } from "@/components/customer/toss-payment-button"
import { DeliveryStatusRealtime } from "@/components/customer/delivery-status-realtime"

export const dynamic = "force-dynamic"

const statusConfig = {
  pending: { label: "기사 배정 대기 중", color: "bg-yellow-100 text-yellow-800" },
  accepted: { label: "수락됨", color: "bg-blue-100 text-blue-800" },
  picked_up: { label: "픽업완료", color: "bg-indigo-100 text-indigo-800" },
  in_transit: { label: "배송중", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "완료", color: "bg-green-100 text-green-800" },
  cancelled: { label: "취소됨", color: "bg-gray-100 text-gray-800" },
}

const paymentStatusLabel: Record<string, string> = {
  READY: "결제 대기",
  PENDING: "결제 대기",
  PAID: "결제 완료",
  FAILED: "결제 실패",
  CANCELED: "결제 취소",
  REFUNDED: "환불 완료",
}

export default async function DeliveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { id } = await params
  const sp = searchParams ? await searchParams : {}
  const payParam = sp?.pay
  const isPayRedirect = payParam === "1" || (Array.isArray(payParam) && payParam[0] === "1")

  const { delivery } = await getDeliveryForCustomer(id)
  const { order, payment } = await getOrderPaymentSummaryByDelivery(id)
  const { data: pointRows } = await supabase
    .from("points")
    .select("points, point_type")
    .eq("user_id", user.id)
    .eq("source_id", id)
    .eq("point_type", "earned")

  const earnedPoints =
    pointRows?.reduce((sum, row) => sum + Number(row.points || 0), 0) || 0
  const isCardPayment = (payment?.payment_method || order?.payment_method) === "card"
  const paymentAmount = Number(payment?.amount || order?.order_amount || 0)
  const canPay = paymentAmount > 0 && payment?.status !== "PAID"

  if (!delivery || delivery.customer_id !== user.id) {
    redirect("/customer")
  }

  const showDriverRecommendations = delivery.status === "pending" && !delivery.driver_id
  const { drivers: recommendedDrivers } = showDriverRecommendations
    ? await getRecommendedDriversForDelivery(delivery)
    : { drivers: [] }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <DeliveryStatusRealtime deliveryId={id} />
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline">
            <Link href="/customer">← 돌아가기</Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">배송 추적</h1>
            <p className="text-sm text-muted-foreground">배송 상태를 확인하세요</p>
          </div>
          <Badge className={statusConfig[delivery.status as keyof typeof statusConfig].color}>
            {statusConfig[delivery.status as keyof typeof statusConfig].label}
          </Badge>
        </div>

        {delivery.status === "pending" && !delivery.driver_id && recommendedDrivers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                추천 기사
              </CardTitle>
              <CardDescription>
                출발지 근처 배송 가능 기사입니다. 연결을 원하는 기사를 선택하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DriverRecommendationList
                drivers={recommendedDrivers}
                deliveryId={id}
                openTossAfterConnect={isCardPayment && canPay}
                orderId={order?.id}
                paymentAmount={paymentAmount}
              />
            </CardContent>
          </Card>
        )}
        {delivery.status === "pending" && (recommendedDrivers.length === 0 || delivery.driver_id) && (
          <p className="text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            {!delivery.driver_id
              ? "근처에 배송 가능한 기사가 없거나 기사가 배송 요청을 수락하면 배정됩니다. 잠시만 기다려 주세요."
              : "기사가 배송 요청을 수락하면 배정됩니다. 잠시만 기다려 주세요."}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 배송 정보 + 배송원 정보 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>배송 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">픽업 위치</p>
                      <p className="text-sm text-muted-foreground break-words">{delivery.pickup_address}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{delivery.pickup_contact_name}</span>
                        <span className="text-primary">{delivery.pickup_contact_phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">배송 위치</p>
                      <p className="text-sm text-muted-foreground break-words">{delivery.delivery_address}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{delivery.delivery_contact_name}</span>
                        <span className="text-primary">{delivery.delivery_contact_phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {delivery.item_description && (
                  <div className="flex items-center gap-2 p-4 bg-accent/50 rounded-lg">
                    <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">물품 정보</p>
                      <p className="text-sm text-muted-foreground break-words">{delivery.item_description}</p>
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

            {delivery.driver && (
              <Card>
                <CardHeader>
                  <CardTitle>배송원 정보</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold">{delivery.driver.full_name}</p>
                      <p className="text-sm text-muted-foreground">{delivery.driver.phone}</p>
                    </div>
                    <Button asChild className="flex-shrink-0">
                      <a href={`tel:${delivery.driver.phone}`}>전화하기</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 오른쪽: 결제 정보 + 결제 금액 구성 */}
          <div className="space-y-6">
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
                {isCardPayment && order?.id && canPay && (
                  <div className="pt-3 border-t">
                    <TossPaymentButton
                      orderId={order.id}
                      amount={paymentAmount}
                      disabled={!canPay}
                      autoPay={isPayRedirect}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>결제 금액 구성</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">기사 운임</span>
                  <span className="font-medium">{Number(delivery.driver_fee || 0).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">플랫폼 수수료</span>
                  <span className="font-medium">{Number(delivery.platform_fee || 0).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">플랫폼 이용료 (초기)</span>
                  <span className="font-medium">0원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">포인트 적립</span>
                  <span className="font-medium">{earnedPoints.toLocaleString()}P</span>
                </div>
              </CardContent>
            </Card>
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

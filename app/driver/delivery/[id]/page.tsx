import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDeliveryForDriver } from "@/lib/actions/tracking"
import { DriverLocationUpdater } from "@/components/driver/driver-location-updater"
import { DeliveryStatusTimeline } from "@/components/tracking/delivery-status-timeline"
import { Badge } from "@/components/ui/badge"
import { MapPin, Bike, Clock, Calendar, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { acceptDelivery } from "@/lib/actions/driver"
import { getRoleOverride } from "@/lib/role"
import { OpenLayersMap } from "@/components/driver/openlayers-map"
import { DeliveryCompleteForm } from "@/components/driver/delivery-complete-form"
import { StatusUpdateButton } from "@/components/driver/status-update-button"
import { SubmitButtonPending } from "@/components/ui/submit-button-pending"
import { AcceptDeliveryFromUrl } from "@/components/driver/accept-delivery-from-url"
import { AddressWithKakaoMap } from "@/components/driver/address-with-kakaomap"
import { DriverDeliveryResizable } from "@/components/driver/driver-delivery-resizable"
import { ExpectedTimeBanner, ExceededCompleteMessage } from "@/components/driver/expected-time-banner"
import { formatDistanceKm, haversineKm, parsePoint } from "@/lib/geo"

const statusConfig = {
  accepted: { label: "수락됨", color: "bg-blue-100 text-blue-800" },
  picked_up: { label: "배송 중", color: "bg-indigo-100 text-indigo-800" },
  in_transit: { label: "배송 중", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "완료", color: "bg-green-100 text-green-800" },
}

// 픽업 완료 = 물건 수령 후 출발(배송 시작)으로 보고, 단계 단순화: 수락 → 픽업 완료 → 배송 완료
const statusActionConfig = {
  accepted: { next: "picked_up", label: "픽업 완료" },
  picked_up: { next: "delivered", label: "배송 완료" },
  in_transit: { next: "delivered", label: "배송 완료" },
} as const

const settlementStatusLabel: Record<string, string> = {
  NONE: "정산 없음",
  PENDING: "정산 대기",
  CONFIRMED: "정산 확정",
  PAID_OUT: "출금 완료",
  EXCLUDED: "정산 제외",
}

export default async function DriverDeliveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ accept_delivery?: string }>
}) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ id }, sp] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)])
  const acceptDeliveryId = id && sp?.accept_delivery === id ? id : null

  const [profileRes, roleOverride, deliveryRes, settlementRes, driverInfoRes, paymentRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
    getDeliveryForDriver(id),
    supabase.from("settlements").select("settlement_status, settlement_amount").eq("delivery_id", id).maybeSingle(),
    supabase.from("driver_info").select("current_location").eq("id", user.id).maybeSingle(),
    supabase.from("payments").select("payment_method").eq("delivery_id", id).maybeSingle(),
  ])

  const { data: profile } = profileRes
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) redirect("/")

  const { delivery } = deliveryRes
  if (!delivery) redirect("/driver")

  const { data: settlement } = settlementRes
  const { data: driverInfo } = driverInfoRes
  const paymentMethod = paymentRes.data?.payment_method ?? ""
  const isCash = paymentMethod === "cash"
  const totalFee = Number(delivery.total_fee ?? 0)
  const platformFee = Number(delivery.platform_fee ?? 0)
  const driverFeeAmount = Number(delivery.driver_fee ?? delivery.total_fee ?? 0)
  const isPending = delivery.status === "pending" && !delivery.driver_id
  const isAssignedToMe = delivery.driver_id === user.id
  if (!isPending && !isAssignedToMe) redirect("/driver")

  const pickupCoords = parsePoint(delivery.pickup_location)
  const deliveryCoords = parsePoint(delivery.delivery_location)
  const baseDriverFee = Number(delivery.driver_fee ?? delivery.total_fee ?? 0)

  const driverCoords = parsePoint(driverInfo?.current_location)
  const toPickupKm =
    driverCoords && pickupCoords ? haversineKm(driverCoords, pickupCoords) : null

  async function handleAccept() {
    "use server"
    await acceptDelivery(delivery.id)
    redirect(`/driver/delivery/${delivery.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <AcceptDeliveryFromUrl deliveryId={acceptDeliveryId ?? null} />
      <DriverDeliveryResizable
        mapNode={
          <OpenLayersMap
            pickup={pickupCoords}
            delivery={deliveryCoords}
            pickupDistanceKmFromServer={toPickupKm}
            showMyLocation
            fillContainer
          />
        }
      >
      <div className="p-4 pb-24 md:pb-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">배송 옵션</p>
            <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Bike className="h-3.5 w-3" />
              {delivery.vehicle_type === "motorcycle" ? "오토바이" : delivery.vehicle_type || "오토바이"}
            </Badge>
            {delivery.delivery_option === "scheduled" ? (
              <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300">
                <Calendar className="h-3.5 w-3" />
                예약 픽업
                {delivery.scheduled_pickup_at && (
                  <span className="ml-1">
                    {new Date(delivery.scheduled_pickup_at).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3.5 w-3" />
                즉시 픽업
                {delivery.urgency === "express" && (
                  <span className="ml-1 text-orange-600 flex items-center gap-0.5">
                    <Zap className="h-3 w-3" /> 급송
                  </span>
                )}
              </Badge>
            )}
            {/* 고객 요청 예상시간 (기본 3시간, 급송 30분) */}
            {(() => {
              const expMin = delivery.expected_delivery_minutes ?? (delivery.urgency === "express" ? 30 : 180)
              const isExpress = delivery.urgency === "express" || expMin <= 30
              return (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3.5 w-3" />
                  예상 {expMin < 60 ? `${expMin}분` : `${expMin / 60}시간`}
                  <span className="text-muted-foreground">({isExpress ? "급송" : "기본"})</span>
                </Badge>
              )
            })()}
            </div>
          </div>

        {/* 배송 수락 후 위치 자동 전송 (관리자/고객 실시간 추적용, UI 없이 백그라운드) */}
        {isAssignedToMe && <DriverLocationUpdater deliveryId={delivery.id} silent />}

        {/* 예상시간 기준 진행 중/초과 안내 (배송 완료 전에만) */}
        {isAssignedToMe && (
          <ExpectedTimeBanner
            status={delivery.status}
            acceptedAt={delivery.accepted_at}
            expectedDeliveryMinutes={delivery.expected_delivery_minutes ?? null}
            urgency={delivery.urgency ?? null}
          />
        )}

        {delivery.status === "delivered" && isAssignedToMe && (
          <div className="list-item-card border-amber-200/50 bg-amber-50/90 p-3 shadow-[0_2px_12px_rgba(180,83,9,0.08)]">
            <ExceededCompleteMessage
              acceptedAt={delivery.accepted_at}
              expectedDeliveryMinutes={delivery.expected_delivery_minutes ?? null}
              urgency={delivery.urgency ?? null}
              deliveredAt={delivery.delivered_at}
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>픽업/배송 정보</CardTitle>
            <CardDescription className="sr-only md:not-sr-only">
              담당자, 연락처, 메모가 아래에 함께 표시됩니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 픽업 */}
            <div className="list-item-card bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1">
                <MapPin className="h-4 w-4 text-blue-600" />
                픽업
              </p>
              <div>
                <AddressWithKakaoMap
                  address={delivery.pickup_address ?? ""}
                  coords={pickupCoords}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground">담당자</span>
                <span>{delivery.pickup_contact_name}</span>
                <span className="text-muted-foreground">연락처</span>
                <Button asChild size="sm" variant="outline" className="h-7">
                  <a href={`tel:${delivery.pickup_contact_phone}`}>{delivery.pickup_contact_phone}</a>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">메모</span> {delivery.pickup_notes || "없음"}
              </p>
            </div>
            {/* 배송 */}
            <div className="list-item-card bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1">
                <MapPin className="h-4 w-4 text-red-600" />
                배송
              </p>
              <div>
                <AddressWithKakaoMap
                  address={delivery.delivery_address ?? ""}
                  coords={deliveryCoords}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground">담당자</span>
                <span>{delivery.delivery_contact_name}</span>
                <span className="text-muted-foreground">연락처</span>
                <Button asChild size="sm" variant="outline" className="h-7">
                  <a href={`tel:${delivery.delivery_contact_phone}`}>{delivery.delivery_contact_phone}</a>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">메모</span> {delivery.delivery_notes || "없음"}
              </p>
            </div>
          </CardContent>
        </Card>

        {delivery.status !== "pending" && (
          <Card>
            <CardHeader>
              <CardTitle>배송 진행 상황</CardTitle>
            </CardHeader>
            <CardContent>
              <DeliveryStatusTimeline delivery={delivery} />
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>물품 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                const itemTypeMap: Record<string, { label: string; weight: string; size: string }> = {
                  document: { label: "서류", weight: "~1kg", size: "A4 이하" },
                  small:    { label: "소형", weight: "~5kg", size: "30cm 이하" },
                  medium:   { label: "중형", weight: "~10kg", size: "30~60cm" },
                  large:    { label: "대형", weight: "~20kg", size: "60cm 이상" },
                }
                const raw = (delivery.item_description ?? "").trim()
                const typeInfo = itemTypeMap[raw]
                // item_description이 타입 코드면 typeInfo 사용, 아니면 그대로 설명으로 표시
                const typeLabel = typeInfo ? typeInfo.label : (raw || "-")
                // package_size: 신규 저장 건은 사용자 설명, 구 저장 건은 크기 문자열
                const userDesc = delivery.package_size ?? null
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">물품 종류</span>
                      <span className="font-medium">{typeLabel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">무게 기준</span>
                      <span className="font-medium">
                        {typeInfo ? typeInfo.weight : (delivery.item_weight ? `${delivery.item_weight}kg` : "-")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">크기 기준</span>
                      <span className="font-medium">{typeInfo ? typeInfo.size : "-"}</span>
                    </div>
                    {userDesc && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">물품 설명</span>
                        <span className="font-medium">{userDesc}</span>
                      </div>
                    )}
                    {toPickupKm !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">픽업장소까지</span>
                        <span className="font-medium">{formatDistanceKm(toPickupKm) || "-"}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">픽업 → 배송장소</span>
                      <span className="font-medium">
                        {delivery.distance_km != null ? formatDistanceKm(delivery.distance_km) : "-"}
                      </span>
                    </div>
                  </>
                )
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>유의사항</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>요금은 플랫폼 요금 기준으로 자동 산정됩니다.</p>
              <p>물품 파손·분실은 약관 범위 내에서 처리됩니다.</p>
              <p>인적 사고는 기사 개인 책임입니다.</p>
              <p>수락 후 고객 연락처가 공개됩니다.</p>
              {isAssignedToMe && (
                <p>
                  배송 중 사고 발생 시{" "}
                  <Link href={`/driver/accident?deliveryId=${delivery.id}`} className="text-primary font-medium underline underline-offset-2 hover:no-underline">
                    사고 신고
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>최종 수익 정보</CardTitle>
            {isCash && (
              <CardDescription>현금 결제 건 · 고객에게 수령한 금액에서 수수료를 제외한 금액이 정산됩니다.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {isCash ? (
              <>
                <div className="list-item-card bg-muted/50 p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">고객 결제 금액 (현금 수령)</span>
                    <span className="font-medium">{totalFee.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">플랫폼 수수료</span>
                    <span className="font-medium">- {platformFee.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-medium">기사 수령 금액 (정산 반영)</span>
                    <span className="text-xl font-bold text-green-600">{driverFeeAmount.toLocaleString()}원</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  고객에게서 현금으로 받은 금액에서 수수료를 제외한 금액이 적립금에 반영됩니다.
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">예상 수익</span>
                  <span className="text-xl font-bold text-green-600">{baseDriverFee.toLocaleString()}원</span>
                </div>
                {totalFee > 0 && platformFee > 0 && (
                  <div className="text-sm text-muted-foreground">
                    고객 결제 {totalFee.toLocaleString()}원 · 수수료 {platformFee.toLocaleString()}원 제외
                  </div>
                )}
              </>
            )}
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={`/driver/reward/${delivery.id}`}>리워드 적용 보기</Link>
            </Button>
          </CardContent>
        </Card>

        {(delivery.status === "delivered" || settlement?.settlement_status) && (
          <Card>
            <CardHeader>
              <CardTitle>정산 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">정산 금액</span>
                <span className="font-semibold">
                  {Number(settlement?.settlement_amount ?? baseDriverFee).toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">정산 상태</span>
                <span className="font-medium">
                  {settlement?.settlement_status
                    ? settlementStatusLabel[settlement.settlement_status] || settlement.settlement_status
                    : "정산 대기"}
                </span>
              </div>
              {settlement?.settlement_status === "CONFIRMED" && (
                <p className="text-xs text-emerald-700 font-semibold">
                  관리자 정산 확정 → 출금 가능 금액에 반영됨
                </p>
              )}
              {settlement?.settlement_status === "PENDING" && (
                <p className="text-xs text-muted-foreground">정산 확정 전에는 출금 가능 금액에 포함되지 않습니다.</p>
              )}
            </CardContent>
          </Card>
        )}

        {delivery.status === "delivered" && (
          <div className="space-y-3">
            <div className="list-item-card border-green-200/50 bg-green-50/95 px-4 py-3 text-sm text-green-800 shadow-[0_2px_12px_rgba(22,101,52,0.08)]">
              배송이 완료되었습니다. 이 건은 더 이상 수정할 수 없습니다.
            </div>
            {delivery.delivery_proof_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">배송 완료 인증</CardTitle>
                  <CardDescription>업로드한 인증 사진입니다</CardDescription>
                </CardHeader>
                <CardContent>
                  <img
                    src={delivery.delivery_proof_url}
                    alt="배송 완료 인증"
                    className="w-full max-h-64 object-contain rounded-lg border"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        </div>

        {/* 액션 버튼: 모바일에서는 하단 고정(z-20)으로 지도에 가려지지 않도록 */}
        <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-3 p-4 bg-white/95 backdrop-blur border-t shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:static md:z-auto md:bg-transparent md:backdrop-blur-none md:border-0 md:shadow-none md:p-0">
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href={isPending ? "/driver/available" : "/driver"}>넘기기</Link>
          </Button>
          {isPending ? (
            <form action={handleAccept} className="flex-1">
              <SubmitButtonPending className="w-full" size="lg" pendingLabel="수락 중…">
                배송 수락하기
              </SubmitButtonPending>
            </form>
          ) : statusActionConfig[delivery.status as keyof typeof statusActionConfig] ? (
            statusActionConfig[delivery.status as keyof typeof statusActionConfig].next ===
            "delivered" ? (
              <DeliveryCompleteForm
                deliveryId={delivery.id}
                label={statusActionConfig[delivery.status as keyof typeof statusActionConfig].label}
                className="flex-1 w-full"
              />
            ) : (
              <StatusUpdateButton
                deliveryId={delivery.id}
                nextStatus={statusActionConfig[delivery.status as keyof typeof statusActionConfig].next}
                label={statusActionConfig[delivery.status as keyof typeof statusActionConfig].label}
                className="flex-1 w-full"
              />
            )
          ) : (
            <Button className="flex-1" size="lg" disabled>
              처리 완료
            </Button>
          )}
        </div>
      </div>
      </DriverDeliveryResizable>
    </div>
  )
}

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getDeliveryForDriver } from "@/lib/actions/tracking"
import { DriverLocationUpdater } from "@/components/driver/driver-location-updater"
import { DeliveryStatusTimeline } from "@/components/tracking/delivery-status-timeline"
import { Badge } from "@/components/ui/badge"
import { MapPin, Phone, Bike, Clock, Calendar, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { acceptDelivery, updateDeliveryStatus } from "@/lib/actions/driver"
import { getRoleOverride } from "@/lib/role"
import { OpenLayersMap } from "@/components/driver/openlayers-map"
import { SubmitButtonPending } from "@/components/ui/submit-button-pending"
import { AcceptDeliveryFromUrl } from "@/components/driver/accept-delivery-from-url"

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"

  if (!canActAsDriver) {
    redirect("/")
  }

  const { id } = await params
  const sp = await searchParams
  const acceptDeliveryId = id && sp?.accept_delivery === id ? id : null
  const { delivery } = await getDeliveryForDriver(id)

  const { data: settlement } = await supabase
    .from("settlements")
    .select("settlement_status, settlement_amount")
    .eq("delivery_id", id)
    .maybeSingle()

  if (!delivery) {
    redirect("/driver")
  }

  const isPending = delivery.status === "pending" && !delivery.driver_id
  const isAssignedToMe = delivery.driver_id === user.id

  if (!isPending && !isAssignedToMe) {
    redirect("/driver")
  }

  const parsePoint = (value: any) => {
    if (!value) return null
    if (typeof value === "object" && Array.isArray(value.coordinates)) {
      const [lng, lat] = value.coordinates
      return { lat, lng }
    }
    if (typeof value === "object" && typeof value.x === "number" && typeof value.y === "number") {
      return { lng: value.x, lat: value.y }
    }
    if (typeof value === "string") {
      const matches = value.match(/-?\d+(?:\.\d+)?/g)
      if (matches && matches.length >= 2) {
        const lng = Number(matches[0])
        const lat = Number(matches[1])
        return { lat, lng }
      }
    }
    return null
  }

  const pickupCoords = parsePoint(delivery.pickup_location)
  const deliveryCoords = parsePoint(delivery.delivery_location)
  const baseDriverFee = Number(delivery.driver_fee ?? delivery.total_fee ?? 0)

  async function handleAccept() {
    "use server"
    await acceptDelivery(delivery.id)
    redirect(`/driver/delivery/${delivery.id}`)
  }

  async function handleUpdateStatus(formData: FormData) {
    "use server"
    const status = String(formData.get("status") || "")
    if (!["picked_up", "in_transit", "delivered"].includes(status)) {
      return
    }
    await updateDeliveryStatus(delivery.id, status)
    redirect(`/driver/delivery/${delivery.id}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <AcceptDeliveryFromUrl deliveryId={acceptDeliveryId ?? null} />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">출발지(픽업) 입력칸</p>
              <Input value={delivery.pickup_address} readOnly />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">도착지(배송) 입력칸</p>
              <Input value={delivery.delivery_address} readOnly />
            </div>
          </div>
          <OpenLayersMap pickup={pickupCoords} delivery={deliveryCoords} showMyLocation />
          <div className="space-y-2 pt-2">
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
            </div>
          </div>
        </div>

        {/* 위치추적: 나중에 사용할 수 있도록 코드 유지, 표시만 비활성화 */}
        {false && isAssignedToMe && <DriverLocationUpdater deliveryId={delivery.id} />}

        <Card>
          <CardHeader>
            <CardTitle>픽업/배송 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">구분</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead className="w-[140px]">담당자</TableHead>
                  <TableHead className="w-[140px]">연락처</TableHead>
                  <TableHead>메모</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-semibold">픽업</TableCell>
                  <TableCell>{delivery.pickup_address}</TableCell>
                  <TableCell>{delivery.pickup_contact_name}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <a href={`tel:${delivery.pickup_contact_phone}`}>{delivery.pickup_contact_phone}</a>
                    </Button>
                  </TableCell>
                  <TableCell>{delivery.pickup_notes || "없음"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">배송</TableCell>
                  <TableCell>{delivery.delivery_address}</TableCell>
                  <TableCell>{delivery.delivery_contact_name}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <a href={`tel:${delivery.delivery_contact_phone}`}>{delivery.delivery_contact_phone}</a>
                    </Button>
                  </TableCell>
                  <TableCell>{delivery.delivery_notes || "없음"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
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
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">거리</span>
                      <span className="font-medium">{delivery.distance_km?.toFixed(1) ?? "-"}km</span>
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
              <p>요금은 카카오픽 기준으로 자동 산정됩니다.</p>
              <p>물품 파손·분실은 약관 범위 내에서 처리됩니다.</p>
              <p>인적 사고는 기사 개인 책임입니다.</p>
              <p>수락 후 고객 연락처가 공개됩니다.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>최종 수익 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">예상 수익</span>
              <span className="text-xl font-bold text-green-600">{baseDriverFee.toLocaleString()}원</span>
            </div>
            <p className="text-sm text-muted-foreground">거리/좌표 기준 카카오픽 방식으로 산정됩니다.</p>
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
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            배송이 완료되었습니다. 이 건은 더 이상 수정할 수 없습니다.
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/driver">넘기기</Link>
          </Button>
          {isPending ? (
            <form action={handleAccept} className="flex-1">
              <SubmitButtonPending className="w-full" size="lg" pendingLabel="수락 중…">
                배송 수락하기
              </SubmitButtonPending>
            </form>
          ) : statusActionConfig[delivery.status as keyof typeof statusActionConfig] ? (
            <form action={handleUpdateStatus} className="flex-1">
              <input
                type="hidden"
                name="status"
                value={statusActionConfig[delivery.status as keyof typeof statusActionConfig].next}
              />
              <SubmitButtonPending className="w-full" size="lg">
                {statusActionConfig[delivery.status as keyof typeof statusActionConfig].label}
              </SubmitButtonPending>
            </form>
          ) : (
            <Button className="flex-1" size="lg" disabled>
              처리 완료
            </Button>
          )}
        </div>

      </div>
    </div>
  )
}

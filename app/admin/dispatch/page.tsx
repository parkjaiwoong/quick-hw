import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Phone, AlertTriangle, CheckCircle } from "lucide-react"
import { getRoleOverride } from "@/lib/role"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DeliveryTrackingMap } from "@/components/tracking/delivery-tracking-map"

export default async function DispatchPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  // 주문 & 연결 로그 가져오기
  const { data: deliveries, error: deliveriesError } = await supabase
    .from("deliveries")
    .select("id, created_at, status, pickup_address, delivery_address, customer_id, driver_id, driver_fee, total_fee")
    .order("created_at", { ascending: false })
    .limit(100)

  const deliveryIds = (deliveries || []).map((d: any) => d.id)

  const { data: payments } = deliveryIds.length
    ? await supabase
        .from("payments")
        .select("delivery_id, status, amount, payment_method, created_at")
        .in("delivery_id", deliveryIds)
        .order("created_at", { ascending: false })
    : { data: [] }

  const paymentMap = new Map<string, any>()
  for (const payment of payments || []) {
    if (!paymentMap.has(payment.delivery_id)) {
      paymentMap.set(payment.delivery_id, payment)
    }
  }

  const { data: settlements } = deliveryIds.length
    ? await supabase
        .from("settlements")
        .select("delivery_id, settlement_status, settlement_amount")
        .in("delivery_id", deliveryIds)
    : { data: [] }

  const settlementMap = new Map((settlements || []).map((s: any) => [s.delivery_id, s]))

  const profileIds = Array.from(
    new Set((deliveries || []).flatMap((d: any) => [d.customer_id, d.driver_id]).filter(Boolean)),
  )
  const { data: profileRows } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
    : { data: [] }
  const profileMap = new Map((profileRows || []).map((row: any) => [row.id, row]))

  // 사고 발생 여부 확인
  const { data: accidents } = await supabase
    .from("accident_reports")
    .select("delivery_id, status")
    .in("delivery_id", deliveries?.map((d: any) => d.id) || [])

  const accidentMap = new Map(
    accidents?.map((a: any) => [a.delivery_id, a.status]) || []
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>메인 화면 이동</CardTitle>
            <CardDescription>역할별 메인 화면으로 바로 이동합니다</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/admin">관리자 메인</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/driver">기사 메인</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/customer">고객 메인</Link>
            </Button>
          </CardContent>
        </Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">주문 & 연결 로그</h1>
            <p className="text-muted-foreground mt-1">
              누가 언제 누구와 연결됐는지, 통화 여부, 사고 발생 여부를 확인하세요
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>연결 로그</CardTitle>
            <CardDescription>법적 분쟁 대비 핵심 자료</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveriesError ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                주문 로그를 불러오지 못했습니다: {deliveriesError.message}
              </div>
            ) : (
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>요청 시간</TableHead>
                  <TableHead>고객</TableHead>
                  <TableHead>기사</TableHead>
                  <TableHead>출발지 → 도착지</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>통화 여부</TableHead>
                  <TableHead>사고 발생</TableHead>
                  <TableHead>상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries && deliveries.length > 0 ? (
                  deliveries.map((delivery: any) => {
                    const hasAccident = accidentMap.has(delivery.id)
                    const accidentStatus = accidentMap.get(delivery.id)
                    const payment = paymentMap.get(delivery.id)
                    const settlement = settlementMap.get(delivery.id)

                    return (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          {new Date(delivery.created_at).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell>
                          {profileMap.get(delivery.customer_id)?.full_name ||
                            profileMap.get(delivery.customer_id)?.email ||
                            "알 수 없음"}
                        </TableCell>
                        <TableCell>
                          {delivery.driver_id ? (
                            profileMap.get(delivery.driver_id)?.full_name ||
                            profileMap.get(delivery.driver_id)?.email ||
                            "알 수 없음"
                          ) : (
                            <Badge variant="outline">미연결</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {delivery.pickup_address} → {delivery.delivery_address}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              delivery.status === "delivered"
                                ? "default"
                                : delivery.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {delivery.status === "pending"
                              ? "대기"
                              : delivery.status === "accepted"
                              ? "수락"
                              : delivery.status === "picked_up"
                              ? "픽업"
                              : delivery.status === "in_transit"
                              ? "배송중"
                              : delivery.status === "delivered"
                              ? "완료"
                              : delivery.status === "cancelled"
                              ? "취소"
                              : delivery.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {delivery.driver_id ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <Phone className="h-4 w-4" />
                              <span className="text-xs">연결됨</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">미연결</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasAccident ? (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="h-4 w-4" />
                              <Badge variant="destructive" className="text-xs">
                                {accidentStatus === "reported"
                                  ? "접수"
                                  : accidentStatus === "investigating"
                                  ? "조사중"
                                  : accidentStatus === "resolved"
                                  ? "해결"
                                  : "종료"}
                              </Badge>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">정상</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
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
                                      <span className="font-medium">{payment?.status || "없음"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">정산 상태</span>
                                      <span className="font-medium">{settlement?.settlement_status || "없음"}</span>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">연결 로그가 없습니다</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

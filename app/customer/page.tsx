import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { Package, MapPin, Shield, AlertCircle } from "lucide-react"
import { DeliveryList } from "@/components/customer/delivery-list"
import { getMyDeliveries } from "@/lib/actions/deliveries"
import { getRoleOverride } from "@/lib/role"
import { ReferringDriverForm } from "@/components/customer/referring-driver-form"
import { RiderChangeForm } from "@/components/customer/rider-change-form"

export default async function CustomerDashboard({
  searchParams,
}: {
  searchParams?: { change?: string; until?: string; reason?: string }
}) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  const referringDriverId = profile?.referring_driver_id || null

  let referringDriver: {
    id?: string | null
    full_name?: string | null
    email?: string | null
    phone?: string | null
  } | null = null
  let referringRiderCode: string | null = null

  if (referringDriverId) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      const { createClient: createServiceClient } = await import("@supabase/supabase-js")
      const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)

      const { data: riderRow } = await supabaseService
        .from("riders")
        .select("code")
        .eq("id", referringDriverId)
        .maybeSingle()

      const { data: profileRow } = await supabaseService
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", referringDriverId)
        .maybeSingle()

      referringRiderCode = riderRow?.code ?? null
      referringDriver = profileRow ?? null
    }
  }

  const changeStatus = searchParams?.change
  const cooldownUntil = searchParams?.until
  const errorReason = searchParams?.reason
  const formattedCooldown = cooldownUntil ? new Date(cooldownUntil).toLocaleString("ko-KR") : ""
  const changeMessage =
    changeStatus === "pending"
      ? "기사 변경 요청이 접수되었습니다."
      : changeStatus === "no_current_referral"
        ? "현재 귀속된 기사가 없어 변경 요청을 진행할 수 없습니다."
      : changeStatus === "cooldown"
        ? `쿨타임이 적용 중입니다. ${formattedCooldown || ""}`.trim()
        : changeStatus === "blocked"
          ? errorReason === "already_requested"
            ? "기사 변경 요청은 1회만 가능합니다."
            : "요청이 차단되었습니다."
          : changeStatus === "invalid_code"
            ? "입력한 기사 코드를 찾을 수 없습니다."
            : changeStatus === "same_rider"
              ? "현재 귀속 기사와 동일한 코드입니다."
              : changeStatus === "error"
                ? `요청 처리 중 오류가 발생했습니다.${errorReason ? ` (${errorReason})` : ""}`
                : null

  const roleOverride = await getRoleOverride()
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) {
    redirect("/")
  }

  const { deliveries = [] } = await getMyDeliveries()

  const { data: latestChangeRequest } = await supabase
    .from("rider_change_history")
    .select("id, status, admin_reason, cooldown_until, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === "pending").length,
    inProgress: deliveries.filter((d) => ["accepted", "picked_up", "in_transit"].includes(d.status)).length,
    completed: deliveries.filter((d) => d.status === "delivered").length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* 메인 메시지 */}
        <div className="text-center space-y-4 py-8">
          <h1 className="text-4xl md:text-5xl font-bold text-balance">
            가까운 퀵 기사 빠르게 연결
          </h1>
          <p className="text-xl text-muted-foreground">
            물품 파손·분실 시 보험 처리
          </p>
        </div>

        {/* 법적 고지 */}
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>중요 안내:</strong> 본 플랫폼은 운송 당사자가 아닌 중개 플랫폼입니다. 
            요금은 카카오픽 기준으로 자동 산정됩니다. 
            <Link href="/terms" className="underline ml-1">약관 보기</Link>
          </AlertDescription>
        </Alert>

        {/* 배송 요청 버튼 */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              새 배송 요청하기
            </CardTitle>
            <CardDescription>
              출발지와 도착지를 입력하고 가까운 기사를 연결받으세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full md:w-auto">
              <Link href="/customer/new-delivery">
                <Package className="mr-2 h-5 w-5" />
                기사 연결 요청
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>전체 배송</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>대기 중</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-yellow-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>진행 중</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.inProgress}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-blue-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>완료</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.completed}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-green-600" />
            </CardContent>
          </Card>
        </div>

        {/* 배송 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>내 배송 목록</CardTitle>
            <CardDescription>최근 배송 내역을 확인하고 관리하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <DeliveryList deliveries={deliveries} />
          </CardContent>
        </Card>

        {/* 문의/사고 접수 */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                일반 문의
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/customer/inquiry">문의하기</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-600" />
                물품 사고 접수
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/customer/accident">사고 접수하기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3 pt-4 mt-2 border-t border-border">
          <span className="text-sm font-semibold text-muted-foreground">하단 섹션</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>기사 귀속 상태</CardTitle>
            <CardDescription>현재 귀속된 기사 정보를 표시합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {changeMessage && (
              <Alert variant="default">
                <AlertDescription>{changeMessage}</AlertDescription>
              </Alert>
            )}
            {referringDriverId ? (
              <p className="text-sm">
                귀속 기사: {referringDriver?.full_name || "이름 없음"} 기사 (
                {referringRiderCode || referringDriverId.slice(0, 8).toUpperCase()})
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">귀속된 기사가 없습니다.</p>
            )}
            <RiderChangeForm />
            <div>
              <Button asChild variant="outline" size="sm">
                <Link href="/customer/rider-change-request">기사 변경 요청 내역 보기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 기사 변경 요청</CardTitle>
            <CardDescription>가장 최근 요청의 처리 상태를 확인합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {latestChangeRequest ? (
              <>
                <div>
                  상태: {latestChangeRequest.status === "denied" ? "rejected" : latestChangeRequest.status}
                </div>
                <div>요청 시간: {new Date(latestChangeRequest.created_at).toLocaleString("ko-KR")}</div>
                <div>거절 사유: {latestChangeRequest.admin_reason || "-"}</div>
                {latestChangeRequest.cooldown_until && (
                  <div>
                    쿨타임 종료: {new Date(latestChangeRequest.cooldown_until).toLocaleString("ko-KR")}
                  </div>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/customer/rider-change-request-detail?id=${encodeURIComponent(latestChangeRequest.id)}`}
                  >
                    상세 보기
                  </Link>
                </Button>
              </>
            ) : (
              <div className="text-muted-foreground">최근 요청 내역이 없습니다.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>추천 기사 ID</CardTitle>
            <CardDescription>추천 기사 정보를 등록하거나 변경할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {referringDriver ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                <p className="font-medium">등록된 추천 기사</p>
                <p>ID: {referringDriver.id}</p>
                <p>이름: {referringDriver.full_name || "-"}</p>
                <p>이메일: {referringDriver.email || "-"}</p>
                <p>전화번호: {referringDriver.phone || "-"}</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                등록된 추천 기사 ID가 없습니다.
              </div>
            )}
            <ReferringDriverForm initialReferringDriverId={referringDriverId} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

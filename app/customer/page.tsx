import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { Package, MapPin, Shield, AlertCircle, CreditCard, Coins, Truck, MessageCircle } from "lucide-react"
import { DeliveryList } from "@/components/customer/delivery-list"
import { DeliveriesListRealtime } from "@/components/customer/deliveries-list-realtime"
import { getMyDeliveries, getCustomerMainPageData } from "@/lib/actions/deliveries"
import { getRoleOverride } from "@/lib/role"
import { RiderChangeForm } from "@/components/customer/rider-change-form"
import { TermsButton } from "@/components/common/terms-modal"

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

  const [roleOverride, mainData] = await Promise.all([getRoleOverride(), getCustomerMainPageData(user.id)])

  let profile: { role?: string; full_name?: string | null; referring_driver_id?: string | null } | null = null
  let deliveries: Awaited<ReturnType<typeof getMyDeliveries>>["deliveries"] = []
  let latestChangeRequest: { id: string; status: string; admin_reason?: string | null; cooldown_until?: string | null; created_at: string } | null = null
  let referringRiderCode: string | null = null
  let referringDriver: { full_name?: string | null; email?: string | null; phone?: string | null } | null = null

  if (!mainData.error) {
    profile = mainData.profile as typeof profile
    deliveries = (mainData.deliveries ?? []) as typeof deliveries
    latestChangeRequest = mainData.latestChangeRequest as typeof latestChangeRequest
    referringRiderCode = mainData.referringRiderCode
    referringDriver = mainData.referringProfile as typeof referringDriver
  } else {
    const [{ data: profileRow }, { deliveries: myDeliveries = [] }, { data: changeRow }] = await Promise.all([
      supabase.from("profiles").select("role, full_name, referring_driver_id").eq("id", user.id).single(),
      getMyDeliveries(),
      supabase
        .from("rider_change_history")
        .select("id, status, admin_reason, cooldown_until, created_at")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    profile = profileRow ?? null
    deliveries = myDeliveries
    latestChangeRequest = changeRow ?? null
    const referringDriverId = profile?.referring_driver_id || null
    if (referringDriverId) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        const { createClient: createServiceClient } = await import("@supabase/supabase-js")
        const svc = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)
        const [{ data: riderRow }, { data: refProfile }] = await Promise.all([
          svc.from("riders").select("code").eq("id", referringDriverId).maybeSingle(),
          svc.from("profiles").select("full_name, email, phone").eq("id", referringDriverId).maybeSingle(),
        ])
        referringRiderCode = riderRow?.code ?? null
        referringDriver = refProfile ?? null
      }
    }
  }

  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) {
    redirect("/")
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

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === "pending").length,
    inProgress: deliveries.filter((d) => ["accepted", "picked_up", "in_transit"].includes(d.status)).length,
    completed: deliveries.filter((d) => d.status === "delivered").length,
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero 배너 - 쇼핑몰 스타일 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary to-primary/90 p-6 md:p-8 text-primary-foreground shadow-lg">
        <div className="relative z-10">
          <p className="text-sm font-medium opacity-90 mb-1">퀵HW 배송</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            가까운 기사와 빠르게 연결
          </h1>
          <p className="text-sm opacity-90 mb-6 max-w-md">
            출발지·도착지만 입력하면 즉시 매칭 · 물품 파손·분실 시 보험 처리
          </p>
          <Button asChild size="lg" className="bg-white text-primary hover:bg-white/95 font-semibold shadow-md h-12 px-6 rounded-xl">
            <Link href="/customer/new-delivery">
              <Package className="mr-2 h-5 w-5" />
              배송 요청하기
            </Link>
          </Button>
        </div>
        <div className="absolute -right-4 -bottom-4 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:block">
          <Truck className="h-24 w-24 text-white/20" />
        </div>
      </div>

      {/* 법적 고지 - 컴팩트 */}
      <Alert className="rounded-xl border-orange-200 bg-orange-50/80">
        <AlertCircle className="h-4 w-4 text-orange-600 shrink-0" />
        <AlertDescription className="text-orange-800 text-sm">
          <strong>중개 플랫폼 안내</strong> — 요금은 플랫폼 요금 기준 자동 산정 ·{" "}
          <TermsButton type="service" label="약관 보기" className="inline h-auto p-0 text-xs text-orange-800 underline underline-offset-2" />
        </AlertDescription>
      </Alert>

      {/* 배송 현황 - 깔끔한 카드 스타일 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "전체", value: stats.total, color: "text-foreground" },
          { label: "대기", value: stats.pending, color: "text-amber-600" },
          { label: "진행중", value: stats.inProgress, color: "text-blue-600" },
          { label: "완료", value: stats.completed, color: "text-emerald-600" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-white border border-border/60 shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <p className="text-2xl font-bold">{item.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* 배송 목록 섹션 */}
      <section>
        <DeliveriesListRealtime customerId={user.id} />
        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">내 배송</CardTitle>
            <CardDescription>진행 중·완료·취소된 배송을 확인하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <DeliveryList deliveries={deliveries} />
          </CardContent>
        </Card>
      </section>

      {/* 바로가기 그리드 - 쇼핑몰 메뉴 스타일 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/customer/payments"
          className="group flex items-center gap-4 rounded-xl bg-white border border-border/60 p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">결제 내역</p>
            <p className="text-xs text-muted-foreground truncate">이용금액 확인</p>
          </div>
        </Link>
        <Link
          href="/customer/points"
          className="group flex items-center gap-4 rounded-xl bg-white border border-border/60 p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100">
            <Coins className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">포인트</p>
            <p className="text-xs text-muted-foreground truncate">적립·교환</p>
          </div>
        </Link>
        <Link
          href="/customer/inquiry"
          className="group flex items-center gap-4 rounded-xl bg-white border border-border/60 p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 group-hover:bg-slate-100">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">문의하기</p>
            <p className="text-xs text-muted-foreground truncate">고객센터</p>
          </div>
        </Link>
        <Link
          href="/customer/accident"
          className="group flex items-center gap-4 rounded-xl bg-white border border-border/60 p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 group-hover:bg-red-100">
            <Shield className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">사고 접수</p>
            <p className="text-xs text-muted-foreground truncate">물품 파손 등</p>
          </div>
        </Link>
      </div>

      {/* 기사 귀속 & 변경 요청 - 통합 카드 */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">기사 연결</CardTitle>
          <CardDescription>귀속 기사 정보 및 변경 요청</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {changeMessage && (
            <Alert variant="default" className="rounded-xl">
              <AlertDescription>{changeMessage}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-4">
            {referringRiderCode ? (
              <div className="rounded-xl bg-muted/50 px-4 py-2">
                <p className="text-xs text-muted-foreground">귀속 기사 코드</p>
                <p className="font-semibold">{referringRiderCode}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">귀속된 기사가 없습니다. 기사 공유 링크·QR로 연결됩니다.</p>
            )}
            <RiderChangeForm />
          </div>
          {latestChangeRequest && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-1">최근 기사 변경 요청</p>
              <p className="text-muted-foreground text-xs">
                상태: {latestChangeRequest.status === "denied" ? "거절" : latestChangeRequest.status} ·{" "}
                {new Date(latestChangeRequest.created_at).toLocaleDateString("ko-KR")}
              </p>
              <Button asChild variant="link" size="sm" className="h-auto p-0 mt-1 text-xs">
                <Link href={`/customer/rider-change-request-detail?id=${encodeURIComponent(latestChangeRequest.id)}`}>
                  상세 보기
                </Link>
              </Button>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link href="/customer/rider-change-request">변경 요청 내역</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

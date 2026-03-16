import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDriverSettlementsPageData } from "@/lib/actions/settlement"
import { ensureDriverInfoForUser } from "@/lib/actions/driver"
import { getRoleOverride } from "@/lib/role"
import { Calendar, CheckCircle, DollarSign, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function DriverSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await getSupabaseServerClient()
  const resolvedParams = await searchParams
  const errorMessage = resolvedParams?.error ? decodeURIComponent(resolvedParams.error) : null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [{ data: profile }, roleOverride] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getRoleOverride(),
  ])
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) {
    redirect("/")
  }

  const [pageData, _ensure] = await Promise.all([
    getDriverSettlementsPageData(user.id),
    ensureDriverInfoForUser().catch(() => {}),
  ])
  if ("error" in pageData && pageData.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 flex items-center justify-center">
        <p className="text-destructive">정산 정보를 불러오지 못했습니다.</p>
      </div>
    )
  }
  const settlements = pageData.settlements ?? []
  const wallet = pageData.wallet
  const availableBalance = Number(wallet?.available_balance || 0)
  const pendingAmount = settlements
    .filter((s: any) => s.settlement_status === "PENDING")
    .reduce((sum: number, s: any) => sum + Number(s.settlement_amount || s.net_earnings || 0), 0)
  const currentMonth = new Date()
  const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const monthEarnings = settlements
    .filter((s: any) => {
      const dateValue = s.settlement_period_end || s.created_at
      return dateValue ? new Date(dateValue) >= currentMonthStart : false
    })
    .reduce((sum: number, s: any) => sum + Number(s.net_earnings || s.settlement_amount || 0), 0)

  const completedSettlements = settlements.filter((s: any) => s.status === "completed")
  const settlementStatusLabel: Record<string, string> = {
    PENDING: "정산대기",
    CONFIRMED: "출금가능",
    PAID_OUT: "출금완료",
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {errorMessage && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">정산 내역</h1>
            <p className="text-muted-foreground mt-1">나의 정산 내역을 확인하세요</p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>이번달 누적 수익</CardDescription>
              <CardTitle className="text-2xl">{monthEarnings.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>정산대기 금액</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{pendingAmount.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckCircle className="h-4 w-4 text-amber-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>출금가능 금액</CardDescription>
              <CardTitle className="text-2xl text-emerald-700">{availableBalance.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>출금 요청</CardDescription>
              <CardTitle className="text-2xl">{completedSettlements.length}건</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">출금은 지갑 화면에서 계좌 설정 후 요청하세요.</p>
              <Button asChild size="sm" className="w-full" variant="outline">
                <Link href="/driver/wallet" className="flex items-center justify-center gap-2">
                  <Wallet className="h-4 w-4" />
                  지갑에서 출금 요청하기
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>정산 내역</CardTitle>
            <CardDescription>정산 내역을 확인하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {settlements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">정산 내역이 없습니다</p>
              ) : (
                settlements.map((settlement: any) => (
                  <div key={settlement.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {new Date(settlement.settlement_period_start).toLocaleDateString("ko-KR")}
                        </p>
                        <p className="text-xs text-muted-foreground">주문번호: {settlement.order_id || "-"}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          배송 건수: {settlement.total_deliveries}건
                        </p>
                        <p className="text-sm text-muted-foreground">
                          총 수익: {settlement.total_earnings?.toLocaleString()}원 | 정산 금액:{" "}
                          {settlement.net_earnings?.toLocaleString()}원
                        </p>
                        <div className="mt-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                          차감 내역: 프로그램 사용료 0원 · 기사 수수료 0원
                        </div>
                        {settlement.settlement_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            정산일: {new Date(settlement.settlement_date).toLocaleDateString("ko-KR")}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 rounded text-xs bg-muted">
                          {settlement.settlement_status
                            ? settlementStatusLabel[settlement.settlement_status] || "정산대기"
                            : "정산대기"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


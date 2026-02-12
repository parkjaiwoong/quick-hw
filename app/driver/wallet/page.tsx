import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, Clock } from "lucide-react"
import { getRoleOverride } from "@/lib/role"
import { ensureDriverWallet, getDriverWalletSummary, requestPayout } from "@/lib/actions/finance"

export default async function DriverWalletPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const userId = user?.id
  if (!userId) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) {
    redirect("/")
  }

  await ensureDriverWallet(userId)
  const { wallet } = await getDriverWalletSummary(userId)
  const { data: payoutRequests } = await supabase
    .from("payout_requests")
    .select("id, requested_amount, status, notes, requested_at, settlement_status, payout_status")
    .eq("driver_id", userId)
    .order("requested_at", { ascending: false })
  const { data: recentSettlements } = await supabase
    .from("settlements")
    .select("settlement_status, settlement_amount, created_at, updated_at")
    .eq("driver_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
  const { data: driverDeliveries } = await supabase
    .from("deliveries")
    .select("id, status")
    .eq("driver_id", userId)
  const totalBalance = Number(wallet?.total_balance || 0)
  const availableBalance = Number(wallet?.available_balance || 0)
  const pendingBalance = Number(wallet?.pending_balance || 0)
  const pendingRequestAmount =
    payoutRequests
      ?.filter((p) => p.status === "requested" || p.status === "on_hold" || p.status === "approved")
      .reduce((sum, p) => sum + Number(p.requested_amount || 0), 0) || 0
  const completedRequestAmount =
    payoutRequests
      ?.filter((p) => p.status === "transferred" || p.status === "paid")
      .reduce((sum, p) => sum + Number(p.requested_amount || 0), 0) || 0
  const isRequestInProgress = pendingRequestAmount > 0
  const isPayoutEligible = availableBalance > 0 && !isRequestInProgress
  const latestSettlement = recentSettlements?.[0]
  const latestPayoutRequest = payoutRequests?.[0]
  const totalDeliveries = driverDeliveries?.length || 0
  const completedSettlements = recentSettlements?.filter((s) => ["CONFIRMED", "PAID_OUT"].includes(s.settlement_status)) || []
  const settlementCompletionRate =
    recentSettlements && recentSettlements.length > 0
      ? Math.round((completedSettlements.length / recentSettlements.length) * 100)
      : 0
  const avgSettlementHours =
    completedSettlements.length > 0
      ? Math.round(
          completedSettlements.reduce((sum, s) => {
            if (!s.created_at || !s.updated_at) return sum
            const diffMs = new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()
            return sum + Math.max(diffMs, 0)
          }, 0) /
            completedSettlements.length /
            (1000 * 60 * 60),
        )
      : 0

  async function handleRequestPayout(formData: FormData) {
    "use server"
    const rawAmount = Number(formData.get("amount") || 0)
    await requestPayout(userId, rawAmount)
    redirect("/driver/wallet")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">적립금 지갑</h1>
          <p className="text-muted-foreground mt-1">정산 및 출금 상태를 확인하세요</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>출금 가능 금액</CardDescription>
              <CardTitle className="text-2xl text-green-700 flex items-center gap-2">
                {availableBalance.toLocaleString()}원
                {availableBalance > 0 && <CheckCircle className="h-5 w-5 text-emerald-600" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">정산 확정 후 출금 가능</CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/60">
            <CardHeader className="pb-2">
              <CardDescription>출금 요청 중</CardDescription>
              <CardTitle className="text-2xl text-blue-700">{pendingRequestAmount.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">처리 대기 중인 요청</CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader className="pb-2">
              <CardDescription>출금 완료</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{completedRequestAmount.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">정산 완료 후 출금된 합계</CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>현재 적립금</CardDescription>
              <CardTitle className="text-2xl">{totalBalance.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">배송 완료 후 적립됩니다</CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader className="pb-2">
              <CardDescription>정산 대기</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{pendingBalance.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              정산 확정 전 금액
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>정산/출금 타임라인</CardTitle>
            <CardDescription>현재 진행 상태를 한눈에 확인하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">배송 완료</span>
              <span className="font-medium">{totalBalance > 0 ? "완료" : "대기"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">정산 대기</span>
              <span className="font-medium">
                {latestSettlement?.settlement_status === "PENDING" ? "진행 중" : "대기"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">정산 확정</span>
              <span className="font-medium">
                {latestSettlement?.settlement_status && ["CONFIRMED", "PAID_OUT"].includes(latestSettlement.settlement_status)
                  ? "완료"
                  : "대기"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">출금 요청</span>
              <span className="font-medium">
                {latestPayoutRequest ? "진행 중" : "대기"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">출금 완료</span>
              <span className="font-medium">
                {latestPayoutRequest?.status === "transferred" || latestPayoutRequest?.status === "paid" ? "완료" : "대기"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>신뢰 지표</CardTitle>
            <CardDescription>정산/출금 흐름의 투명성을 제공합니다</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">총 배송 건수</p>
              <p className="text-lg font-semibold">{totalDeliveries}건</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">정산 완료율</p>
              <p className="text-lg font-semibold">{settlementCompletionRate}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">평균 정산 소요일</p>
              <p className="text-lg font-semibold">{avgSettlementHours}시간</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">정산 확정 안내</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            정산이 확정되면 <strong>출금 가능 금액</strong>으로 전환됩니다.
            <p className="mt-2 text-xs text-muted-foreground">본 정산은 급여가 아닙니다.</p>
          </CardContent>
        </Card>

        {availableBalance > 0 && (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-emerald-800">관리자 정산 확정 완료</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-emerald-700">
              출금 가능 금액에 반영되었습니다.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>출금 요청</CardTitle>
            <CardDescription>출금 가능 금액 내에서 요청 가능합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleRequestPayout} className="flex flex-col md:flex-row gap-3">
              <Input name="amount" type="number" min={0} step="1" placeholder="출금 금액 (원)" />
              <Button type="submit" disabled={!isPayoutEligible}>
                출금 요청
              </Button>
            </form>
            {!isPayoutEligible && (
              <p className="text-xs text-muted-foreground mt-2">
                {isRequestInProgress
                  ? "출금 요청이 처리 중입니다. 완료 후 추가 요청이 가능합니다."
                  : "정산 확정 후 출금 가능 금액이 발생하면 요청할 수 있습니다."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>출금 요청 내역</CardTitle>
            <CardDescription>최근 요청 상태를 확인하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(payoutRequests || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">출금 요청 내역이 없습니다</p>
            ) : (
              (payoutRequests || []).map((payout) => {
                const mappedSettlementStatus =
                  payout.settlement_status ||
                  (payout.status === "approved" || payout.status === "transferred"
                    ? "CONFIRMED"
                    : payout.status === "on_hold"
                      ? "HOLD"
                      : "READY")
                const mappedPayoutStatus =
                  payout.payout_status ||
                  (payout.status === "approved"
                    ? "WAITING"
                    : payout.status === "transferred"
                      ? "PAID_OUT"
                      : "NONE")
                const statusLabel =
                  payout.status === "transferred" || payout.status === "paid"
                    ? "출금 완료"
                    : payout.status === "approved"
                      ? "승인"
                      : payout.status === "failed"
                        ? "실패"
                        : payout.status === "canceled"
                          ? "취소"
                    : payout.status === "on_hold"
                      ? "보류"
                      : payout.status === "rejected"
                        ? "반려"
                    : "요청됨"
                const statusMessage =
                  payout.status === "transferred" || payout.status === "paid"
                    ? "출금 완료"
                    : payout.status === "approved"
                      ? "출금 승인됨 (이체 대기)"
                      : payout.status === "failed"
                        ? "출금 처리 실패 (관리자 확인 중)"
                        : payout.status === "canceled"
                          ? "출금 요청이 취소되었습니다."
                    : payout.status === "on_hold"
                      ? "출금 요청이 확인 중입니다."
                      : payout.status === "rejected"
                        ? "출금 요청이 반려되었습니다."
                    : "출금 요청이 접수되었습니다."
                return (
                  <div key={payout.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{Number(payout.requested_amount).toLocaleString()}원</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payout.requested_at).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <span className="text-xs rounded px-2 py-1 bg-muted">{statusLabel}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>회계 상태: {mappedSettlementStatus}</span>
                      <span>이체 상태: {mappedPayoutStatus}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{statusMessage}</p>
                    {(payout.status === "rejected" || payout.status === "on_hold") && payout.notes && (
                      <p className="text-xs text-red-600">사유: {payout.notes}</p>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

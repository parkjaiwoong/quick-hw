import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, Clock } from "lucide-react"
import { getRoleOverride } from "@/lib/role"
import { ensureDriverWallet, getDriverWalletPageData, getDriverPayoutRequestsFiltered, requestPayout, updateDriverBankAccount } from "@/lib/actions/finance"
import { ensureDriverInfoForUser } from "@/lib/actions/driver"
import { SubmitButtonPending } from "@/components/ui/submit-button-pending"
import { PayoutListClient } from "@/components/driver/payout-list-client"

const PAYOUT_PAGE_SIZE = 10

type PageProps = { searchParams?: Promise<{ error?: string; saved?: string; payoutStatus?: string; payoutYear?: string; payoutPage?: string }> }

export default async function DriverWalletPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServerClient()
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const payoutError = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : null
  const savedSuccess = resolvedSearchParams.saved === "1"
  const payoutStatus = (resolvedSearchParams.payoutStatus ?? "all").trim() || "all"
  const payoutPageNum = Math.max(1, parseInt(resolvedSearchParams.payoutPage ?? "1", 10) || 1)

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

  const [{ data: profile }, roleOverride] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
  ])
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) {
    redirect("/")
  }

  const [pageData, _ensureResult, payoutListResult] = await Promise.all([
    getDriverWalletPageData(userId),
    (async () => {
      try {
        await ensureDriverWallet(userId)
        await ensureDriverInfoForUser()
      } catch (e) {
        console.error("[driver/wallet] ensure failed:", e)
      }
    })(),
    getDriverPayoutRequestsFiltered(userId, {
      status: payoutStatus === "all" ? undefined : payoutStatus,
      requestYear: payoutYear || undefined,
      page: payoutPageNum,
      pageSize: PAYOUT_PAGE_SIZE,
    }),
  ])
  const wallet = pageData.wallet ?? null
  const payoutRequests = Array.isArray(pageData.payoutRequests) ? pageData.payoutRequests : []
  const payoutListError =
    payoutListResult && "error" in payoutListResult && typeof (payoutListResult as { error?: string }).error === "string"
      ? (payoutListResult as { error: string }).error
      : null
  const payoutListItems = payoutListError ? [] : (payoutListResult?.items ?? [])
  const payoutTotalCount = payoutListError ? 0 : (payoutListResult?.totalCount ?? 0)
  const payoutPage = payoutListResult?.page ?? 1
  const payoutPageSize = payoutListResult?.pageSize ?? PAYOUT_PAGE_SIZE
  const recentSettlements = Array.isArray(pageData.recentSettlements) ? pageData.recentSettlements : []
  const totalDeliveries = Number.isFinite(Number(pageData.totalDeliveries)) ? Number(pageData.totalDeliveries) : 0
  const driverInfo = pageData.driverInfo ?? null

  const totalBalance = Number(wallet?.total_balance ?? 0)
  const availableBalance = Number(wallet?.available_balance ?? 0)
  const pendingBalance = Number(wallet?.pending_balance ?? 0)
  const pendingRequestAmount = payoutRequests
    .filter((p) => p.status === "requested" || p.status === "on_hold" || p.status === "approved")
    .reduce((sum, p) => sum + Number(p.requested_amount || 0), 0)
  const completedRequestAmount = payoutRequests
    .filter((p) => p.status === "transferred" || p.status === "paid")
    .reduce((sum, p) => sum + Number(p.requested_amount || 0), 0)
  const isRequestInProgress = pendingRequestAmount > 0
  const hasBankAccount = Boolean(driverInfo?.bank_account?.trim())
  const isPayoutEligible = availableBalance > 0 && !isRequestInProgress && hasBankAccount
  const latestSettlement = recentSettlements[0] ?? null
  const latestPayoutRequest = payoutRequests[0] ?? null
  const completedSettlements = recentSettlements.filter(
    (s) => s.settlement_status != null && ["CONFIRMED", "PAID_OUT"].includes(s.settlement_status)
  )
  const settlementCompletionRate =
    recentSettlements.length > 0 ? Math.round((completedSettlements.length / recentSettlements.length) * 100) : 0
  let avgSettlementHours = 0
  if (completedSettlements.length > 0) {
    const totalHours = completedSettlements.reduce((sum, s) => {
      if (!s.created_at || !s.updated_at) return sum
      const diffMs = new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()
      const hours = Number.isFinite(diffMs) ? diffMs / (1000 * 60 * 60) : 0
      return sum + (hours >= 0 ? hours : 0)
    }, 0)
    avgSettlementHours = Math.round(totalHours / completedSettlements.length)
  }

  async function handleSaveBankAccount(formData: FormData) {
    "use server"
    const bankName = String(formData.get("bank_name") || "").trim()
    const bankAccount = String(formData.get("bank_account") || "").trim()
    const result = await updateDriverBankAccount(userId, bankName, bankAccount)
    if (result?.error) {
      redirect(`/driver/wallet?error=${encodeURIComponent(result.error)}`)
    }
    redirect("/driver/wallet?saved=1")
  }

  async function handleRequestPayout(formData: FormData) {
    "use server"
    const rawAmount = Number(formData.get("amount") || 0)
    const result = await requestPayout(userId, rawAmount)
    if (result?.error) {
      redirect(`/driver/wallet?error=${encodeURIComponent(result.error)}`)
    }
    redirect("/driver/wallet")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">적립금 지갑</h1>
          <p className="text-muted-foreground mt-1">정산 및 출금 상태를 확인하세요</p>
        </div>
        {payoutError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {payoutError}
          </div>
        )}
        {savedSuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="alert">
            출금 계좌가 저장되었습니다.
          </div>
        )}

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
                {!latestPayoutRequest
                  ? "대기"
                  : latestPayoutRequest.status === "transferred" || latestPayoutRequest.status === "paid"
                    ? "완료"
                    : "진행 중"}
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
            <CardTitle>출금 계좌 설정</CardTitle>
            <CardDescription>출금 요청 시 이 계좌로 입금됩니다. 계좌를 먼저 등록한 뒤 출금 요청을 하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasBankAccount && (
              <p className="text-sm text-muted-foreground">
                현재 등록 계좌: {[driverInfo?.bank_name, driverInfo?.bank_account ? `****${String(driverInfo.bank_account).slice(-4)}` : ""].filter(Boolean).join(" ")}
              </p>
            )}
            <form action={handleSaveBankAccount} className="flex flex-col gap-3 max-w-md">
              <div>
                <label htmlFor="bank_name" className="text-sm font-medium mb-1 block">은행명</label>
                <Input id="bank_name" name="bank_name" placeholder="예: 국민은행" defaultValue={driverInfo?.bank_name ?? ""} />
              </div>
              <div>
                <label htmlFor="bank_account" className="text-sm font-medium mb-1 block">계좌번호</label>
                <Input id="bank_account" name="bank_account" placeholder="숫자만 입력" defaultValue={driverInfo?.bank_account ?? ""} />
              </div>
              <SubmitButtonPending pendingLabel="저장 중…">계좌 저장</SubmitButtonPending>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>출금 요청</CardTitle>
            <CardDescription>
              등록한 출금 계좌로 입금됩니다. 위에서 계좌를 먼저 설정한 뒤 금액만 입력해 요청하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleRequestPayout} className="flex flex-col md:flex-row gap-3">
              <Input name="amount" type="number" min={0} step="1" placeholder="출금 금액 (원)" />
              <Button type="submit" disabled={!isPayoutEligible}>
                출금 요청
              </Button>
            </form>
            {!hasBankAccount && (
              <p className="text-xs text-amber-700 mt-2">출금 계좌를 먼저 설정해 주세요.</p>
            )}
            {hasBankAccount && !isPayoutEligible && (
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
            <CardDescription>출금 요청·상태 조건으로 조회 (화면 새로고침 없이 데이터만 갱신)</CardDescription>
          </CardHeader>
          <CardContent>
            <PayoutListClient
              initialData={{
                items: payoutListItems,
                totalCount: payoutTotalCount,
                page: payoutPage,
                pageSize: PAYOUT_PAGE_SIZE,
              }}
              initialStatus={payoutStatus}
              initialRequestYear={payoutYear}
              initialError={payoutListError}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

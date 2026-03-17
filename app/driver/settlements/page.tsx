import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDriverSettlementsFiltered, getDriverSettlementsPageData } from "@/lib/actions/settlement"
import { ensureDriverInfoForUser } from "@/lib/actions/driver"
import { getRoleOverride } from "@/lib/role"
import { Calendar, CheckCircle, DollarSign } from "lucide-react"
import { SettlementsListClient } from "@/components/driver/settlements-list-client"

const PAGE_SIZE = 10

function getCurrentMonthYYYYMM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

type SearchParams = Promise<{
  error?: string
  settlementMonth?: string
  paymentMethod?: string
  status?: string
  page?: string
}>

export default async function DriverSettlementsPage({ searchParams }: { searchParams: SearchParams }) {
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

  const effectiveMonth = (resolvedParams.settlementMonth ?? getCurrentMonthYYYYMM()).trim() || getCurrentMonthYYYYMM()

  const [result, summaryData, _ensure] = await Promise.all([
    getDriverSettlementsFiltered(user.id, {
      settlementMonth: effectiveMonth,
      paymentMethod: resolvedParams.paymentMethod,
      status: resolvedParams.status,
      page: resolvedParams.page ? Number(resolvedParams.page) : 1,
      pageSize: PAGE_SIZE,
    }),
    getDriverSettlementsPageData(user.id),
    ensureDriverInfoForUser().catch(() => {}),
  ])

  if ("error" in result && result.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 flex items-center justify-center">
        <p className="text-destructive">정산 정보를 불러오지 못했습니다.</p>
      </div>
    )
  }

  const allSettlements = "error" in summaryData ? [] : (summaryData.settlements ?? [])
  const summaryWallet = "error" in summaryData ? null : summaryData.wallet
  const { settlements, totalCount, page, pageSize, wallet } = result
  const availableBalance = Number(wallet?.available_balance ?? summaryWallet?.available_balance ?? 0)
  const pendingAmount = allSettlements
    .filter((s: any) => s.settlement_status === "PENDING")
    .reduce((sum: number, s: any) => sum + Number(s.settlement_amount || s.net_earnings || 0), 0)
  const currentMonth = new Date()
  const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const monthEarnings = allSettlements
    .filter((s: any) => {
      const dateValue = s.settlement_period_end || s.created_at
      return dateValue ? new Date(dateValue) >= currentMonthStart : false
    })
    .reduce((sum: number, s: any) => sum + Number(s.net_earnings || s.settlement_amount || 0), 0)
  const completedSettlements = allSettlements.filter((s: any) => s.status === "completed")
  const initialFilters = {
    settlementMonth: effectiveMonth,
    paymentMethod: resolvedParams.paymentMethod ?? "all",
    status: resolvedParams.status ?? "all",
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
              <p className="text-xs text-muted-foreground">출금은 왼쪽 메뉴 &gt; 지갑·출금에서 계좌 설정 후 요청하세요.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>정산 내역</CardTitle>
            <CardDescription>정산월·결제수단·상태로 조회하고 목록을 확인하세요 (화면 새로고침 없이 데이터만 갱신)</CardDescription>
          </CardHeader>
          <CardContent>
            <SettlementsListClient
              initialData={{
                settlements,
                totalCount,
                page,
                pageSize,
              }}
              initialFilters={initialFilters}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


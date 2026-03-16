import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDriverSettlementsFiltered, getDriverSettlementsPageData } from "@/lib/actions/settlement"
import { ensureDriverInfoForUser } from "@/lib/actions/driver"
import { getRoleOverride } from "@/lib/role"
import { Calendar, CheckCircle, DollarSign, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettlementsFiltersForm } from "@/components/driver/settlements-filters-form"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 10
const settlementStatusLabel: Record<string, string> = {
  PENDING: "정산대기",
  READY: "출금대기",
  CONFIRMED: "출금가능",
  PAID_OUT: "출금완료",
}
const paymentMethodLabel: Record<string, string> = {
  cash: "현금",
  card: "카드",
  bank_transfer: "계좌이체",
}

type SearchParams = Promise<{
  error?: string
  dateFrom?: string
  dateTo?: string
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

  const [result, summaryData, _ensure] = await Promise.all([
    getDriverSettlementsFiltered(user.id, {
      dateFrom: resolvedParams.dateFrom,
      dateTo: resolvedParams.dateTo,
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
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasFilters = !!(resolvedParams.dateFrom || resolvedParams.dateTo || resolvedParams.paymentMethod || resolvedParams.status)

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
            <CardDescription>정산일자·결제수단·상태로 조회하고 목록을 확인하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettlementsFiltersForm />
            {settlements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">조건에 맞는 정산 내역이 없습니다</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>정산일자</TableHead>
                        <TableHead>주문/배송</TableHead>
                        <TableHead className="text-right">정산 금액</TableHead>
                        <TableHead>결제수단</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(settlements as any[]).map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            {(s.settlement_period_end || s.created_at)
                              ? new Date(s.settlement_period_end || s.created_at).toLocaleDateString("ko-KR", { dateStyle: "short" })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">주문 {s.order_id || "-"}</span>
                            {s.total_deliveries != null && (
                              <span className="text-xs text-muted-foreground ml-1">· {s.total_deliveries}건</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(s.net_earnings ?? s.settlement_amount ?? 0).toLocaleString()}원
                          </TableCell>
                          <TableCell>
                            {paymentMethodLabel[s.payment?.payment_method ?? ""] ?? (s.payment?.payment_method || "-")}
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-0.5 rounded text-xs bg-muted">
                              {s.settlement_status ? settlementStatusLabel[s.settlement_status] ?? s.settlement_status : "정산대기"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    전체 {totalCount}건 중 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)}건
                  </p>
                  <div className="flex gap-2 items-center">
                    {page <= 1 ? (
                      <Button variant="outline" size="sm" disabled>이전</Button>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/driver/settlements?${new URLSearchParams({
                            ...(resolvedParams.dateFrom && { dateFrom: resolvedParams.dateFrom }),
                            ...(resolvedParams.dateTo && { dateTo: resolvedParams.dateTo }),
                            ...(resolvedParams.paymentMethod && { paymentMethod: resolvedParams.paymentMethod }),
                            ...(resolvedParams.status && { status: resolvedParams.status }),
                            page: String(page - 1),
                          }).toString()}`}
                        >
                          이전
                        </Link>
                      </Button>
                    )}
                    <span className="px-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
                    {page >= totalPages ? (
                      <Button variant="outline" size="sm" disabled>다음</Button>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/driver/settlements?${new URLSearchParams({
                            ...(resolvedParams.dateFrom && { dateFrom: resolvedParams.dateFrom }),
                            ...(resolvedParams.dateTo && { dateTo: resolvedParams.dateTo }),
                            ...(resolvedParams.paymentMethod && { paymentMethod: resolvedParams.paymentMethod }),
                            ...(resolvedParams.status && { status: resolvedParams.status }),
                            page: String(page + 1),
                          }).toString()}`}
                        >
                          다음
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


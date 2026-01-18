import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getRoleOverride } from "@/lib/role"
import { getRiderDashboardCustomers, getRiderDashboardKpi } from "@/lib/actions/rider-dashboard"
import { RiderReferralLink } from "@/components/rider/rider-referral-link"

export const dynamic = "force-dynamic"

export default async function DriverDashboardPage({
  searchParams,
}: {
  searchParams?: { period?: string }
}) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const roleOverride = await getRoleOverride()
  const canActAsRider = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsRider) {
    redirect("/")
  }

  let riderCode: string | null = null
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)
    const { data: riderRow } = await supabaseService.from("riders").select("code").eq("id", user.id).maybeSingle()
    riderCode = riderRow?.code ?? null
  }

  const period = searchParams?.period || "this_month"
  const periodLabel = period === "last_month" ? "지난 달" : period === "all" ? "전체" : "이번 달"

  const { data: kpi, error: kpiError } = await getRiderDashboardKpi(period)
  const { data: customers, error: customersError } = await getRiderDashboardCustomers(period)

  const totalCustomers = Number(kpi?.total_customers || 0)
  const periodNewCustomers = Number(kpi?.period_new_customers || 0)
  const periodOrders = Number(kpi?.period_orders || 0)
  const periodReward = Number(kpi?.period_reward || 0)
  const totalReward = Number(kpi?.total_reward || 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">기사 대시보드</h1>
            <p className="text-muted-foreground mt-1">내 고객과 추가 수익을 한눈에 확인하세요</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <form action="/driver/dashboard" className="flex items-center gap-2">
              <select
                name="period"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={period}
              >
                <option value="this_month">이번 달</option>
                <option value="last_month">지난 달</option>
                <option value="all">전체</option>
              </select>
              <Button type="submit" variant="outline" size="sm">
                적용
              </Button>
            </form>
            <Button asChild variant="outline" size="sm">
              <Link href="/driver">배송원 대시보드로</Link>
            </Button>
          </div>
        </div>

        {kpiError && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            KPI 데이터를 불러오지 못했습니다: {kpiError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>내 고객 수</CardDescription>
              <CardTitle className="text-3xl">{totalCustomers.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {periodLabel} 신규 고객 {periodNewCustomers.toLocaleString()}명
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{periodLabel} 주문 수</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{periodOrders.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">기사 추천으로 연결된 주문 기준</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{periodLabel} 추가 수익</CardDescription>
              <CardTitle className="text-3xl text-green-600">{periodReward.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              누적 수익 {totalReward.toLocaleString()}원
            </CardContent>
          </Card>
        </div>

        <RiderReferralLink riderCode={riderCode} />

        <Card>
          <CardHeader>
            <CardTitle>내 고객 리스트</CardTitle>
            <CardDescription>고객별 주문 현황과 활성 상태를 확인합니다</CardDescription>
          </CardHeader>
          <CardContent>
            {customersError ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                고객 목록을 불러오지 못했습니다: {customersError}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>고객명</TableHead>
                    <TableHead>최근 주문일</TableHead>
                    <TableHead>{periodLabel} 주문 수</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers && customers.length > 0 ? (
                    customers.map((row) => (
                      <TableRow key={row.customer_id}>
                        <TableCell className="font-medium">{row.customer_name}</TableCell>
                        <TableCell>
                          {row.last_order_at ? new Date(row.last_order_at).toLocaleDateString("ko-KR") : "-"}
                        </TableCell>
                        <TableCell>{Number(row.period_order_count || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={row.is_active ? "default" : "secondary"}>
                            {row.is_active ? "활성" : "비활성"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        고객이 없습니다.
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

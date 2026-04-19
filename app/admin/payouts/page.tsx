import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getRoleOverride } from "@/lib/role"
import {
  getAdminPayoutRequestsFiltered,
  getAdminPayoutAllocatableByDriver,
} from "@/lib/actions/finance"
import { PayoutRequestsPanel } from "@/components/admin/payout-requests-panel"
import { PayoutFiltersForm } from "@/components/admin/payout-filters-form"
import {
  approvePayoutAction,
  holdPayoutAction,
  rejectPayoutAction,
  transferPayoutAction,
} from "./actions"

type PageProps = { searchParams?: Promise<{ dateFrom?: string; dateTo?: string; status?: string; driverName?: string }> }

export default async function AdminPayoutsPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  const params = searchParams ? await searchParams : {}
  const { payouts = [] } = await getAdminPayoutRequestsFiltered({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    status: params.status,
    driverName: params.driverName,
  })

  const driverIds = Array.from(new Set(payouts.map((p: any) => p.driver_id).filter(Boolean)))
  const { allocatableByDriver } = await getAdminPayoutAllocatableByDriver(driverIds)

  const [settlementsRes, walletsRes] = await Promise.all([
    driverIds.length
      ? supabase
          .from("settlements")
          .select("id, driver_id, settlement_amount, settlement_status, payment_status, payout_request_id, created_at")
          .in("driver_id", driverIds)
          .order("created_at", { ascending: true })
      : { data: [] as any[] },
    driverIds.length
      ? supabase.from("driver_wallet").select("driver_id, available_balance").in("driver_id", driverIds)
      : { data: [] as any[] },
  ])

  const settlements = settlementsRes.data ?? []
  const wallets = walletsRes.data ?? []
  const settlementsByDriver = settlements.reduce<Record<string, any[]>>((acc, settlement: any) => {
    if (!settlement.driver_id) return acc
    acc[settlement.driver_id] = acc[settlement.driver_id] || []
    acc[settlement.driver_id].push(settlement)
    return acc
  }, {})

  const walletByDriver = wallets.reduce<Record<string, number>>((acc, wallet: any) => {
    if (!wallet.driver_id) return acc
    acc[wallet.driver_id] = Number(wallet.available_balance || 0)
    return acc
  }, {})

  const requestedCount = payouts.filter((p: any) => p.status === "requested").length
  const pendingTotal = payouts
    .filter((p: any) => p.status === "requested" || p.status === "on_hold")
    .reduce((sum: number, p: any) => sum + Number(p.requested_amount || 0), 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayCount = payouts.filter((p: any) => p.requested_at && new Date(p.requested_at) >= today).length
  const todayTotal = payouts
    .filter((p: any) => p.requested_at && new Date(p.requested_at) >= today)
    .reduce((sum: number, p: any) => sum + Number(p.requested_amount || 0), 0)
  const totalAllocatable = Object.values(allocatableByDriver).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">출금 관리</h1>
            <p className="text-muted-foreground mt-1">출금 요청을 확인하고 엑셀을 생성하세요</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/api/admin/payouts/export">엑셀 다운로드</Link>
          </Button>
        </div>

        <PayoutFiltersForm />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className={requestedCount > 0 ? "ring-2 ring-amber-400" : ""}>
            <CardHeader className="pb-2">
              <CardDescription>승인 대기 건수</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{requestedCount}건</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>승인할 전체 금액</CardDescription>
              <CardTitle className="text-2xl">{pendingTotal.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">요청·보류 건 합계</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>기사별 승인 가능 합계</CardDescription>
              <CardTitle className="text-2xl text-emerald-700">{totalAllocatable.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">READY+CONFIRMED 미연결 정산(현금 제외)</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>오늘 요청</CardDescription>
              <CardTitle className="text-2xl">{todayCount}건 / {todayTotal.toLocaleString()}원</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>검증</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              승인·이체 건은 목록에서 &quot;할당 정산 합계 vs 요청금액&quot; 확인. 정산 관리에서 출금요청별 정산도 조회 가능.
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>출금 요청 목록</CardTitle>
            <CardDescription>요청일자·기사명·상태로 조회한 목록. 승인 시 기사별 할당 가능 금액을 참고하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PayoutRequestsPanel
              payouts={payouts}
              settlementsByDriver={settlementsByDriver}
              walletByDriver={walletByDriver}
              allocatableByDriver={allocatableByDriver}
              onApprove={approvePayoutAction}
              onTransfer={transferPayoutAction}
              onHold={holdPayoutAction}
              onReject={rejectPayoutAction}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

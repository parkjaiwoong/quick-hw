import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getRoleOverride } from "@/lib/role"
import { approvePayout, getAdminPayoutRequests, holdPayout, rejectPayout, transferPayout } from "@/lib/actions/finance"
import { PayoutRequestsPanel } from "@/components/admin/payout-requests-panel"

export default async function AdminPayoutsPage() {
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

  const { payouts = [] } = await getAdminPayoutRequests()

  async function handleApprove(payoutId: string) {
    "use server"
    if (!payoutId) return
    await approvePayout(payoutId)
    redirect("/admin/payouts")
  }

  async function handleTransfer(payoutId: string) {
    "use server"
    if (!payoutId) return
    await transferPayout(payoutId, "MANUAL")
    redirect("/admin/payouts")
  }

  async function handleHold(payoutId: string, reason: string) {
    "use server"
    if (!payoutId) return
    await holdPayout(payoutId, reason)
    redirect("/admin/payouts")
  }

  async function handleReject(payoutId: string, reason: string) {
    "use server"
    if (!payoutId) return
    await rejectPayout(payoutId, reason)
    redirect("/admin/payouts")
  }

  const pendingTotal = payouts
    .filter((p: any) => p.status === "requested" || p.status === "on_hold")
    .reduce((sum: number, p: any) => sum + Number(p.requested_amount || 0), 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayCount = payouts.filter((p: any) => p.requested_at && new Date(p.requested_at) >= today).length
  const todayTotal = payouts
    .filter((p: any) => p.requested_at && new Date(p.requested_at) >= today)
    .reduce((sum: number, p: any) => sum + Number(p.requested_amount || 0), 0)

  const driverIds = Array.from(new Set(payouts.map((p: any) => p.driver_id).filter(Boolean)))
  const { data: settlements } = driverIds.length
    ? await supabase
        .from("settlements")
        .select("id, driver_id, settlement_amount, settlement_status, payment_status, payout_request_id, created_at")
        .in("driver_id", driverIds)
        .order("created_at", { ascending: true })
    : { data: [] }

  const { data: wallets } = driverIds.length
    ? await supabase.from("driver_wallet").select("driver_id, available_balance").in("driver_id", driverIds)
    : { data: [] }

  const settlementsByDriver = (settlements || []).reduce<Record<string, any[]>>((acc, settlement: any) => {
    if (!settlement.driver_id) return acc
    acc[settlement.driver_id] = acc[settlement.driver_id] || []
    acc[settlement.driver_id].push(settlement)
    return acc
  }, {})

  const walletByDriver = (wallets || []).reduce<Record<string, number>>((acc, wallet: any) => {
    if (!wallet.driver_id) return acc
    acc[wallet.driver_id] = Number(wallet.available_balance || 0)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
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

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>오늘 요청 건수</CardDescription>
              <CardTitle className="text-2xl">{todayCount}건</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>오늘 요청 금액</CardDescription>
              <CardTitle className="text-2xl">{todayTotal.toLocaleString()}원</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>출금 요청 합계 (대기)</CardDescription>
              <CardTitle className="text-2xl">{pendingTotal.toLocaleString()}원</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>출금 요청 리스트</CardTitle>
            <CardDescription>은행 업로드용 데이터를 확인합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PayoutRequestsPanel
              payouts={payouts}
              settlementsByDriver={settlementsByDriver}
              walletByDriver={walletByDriver}
              onApprove={handleApprove}
              onTransfer={handleTransfer}
              onHold={handleHold}
              onReject={handleReject}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

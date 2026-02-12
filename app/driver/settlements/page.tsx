import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDriverSettlements } from "@/lib/actions/settlement"
import { ensureDriverInfoForUser } from "@/lib/actions/driver"
import { getRoleOverride } from "@/lib/role"
import { Calendar, CheckCircle, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPayout } from "@/lib/actions/finance"

export default async function DriverSettlementsPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const roleOverride = await getRoleOverride()
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) {
    redirect("/")
  }

  if (canActAsDriver) {
    await ensureDriverInfoForUser()
  }

  const { settlements = [] } = await getDriverSettlements()
  const { data: wallet } = await supabase.from("driver_wallet").select("available_balance").eq("driver_id", user.id).maybeSingle()
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

  async function handleRequestPayout(formData: FormData) {
    "use server"
    const rawAmount = Number(formData.get("amount") || 0)
    const bankName = String(formData.get("bank_name") || "").trim()
    const accountNo = String(formData.get("account_no") || "").trim()
    if (bankName || accountNo) {
      await supabase.from("driver_info").update({ bank_name: bankName || null, bank_account: accountNo || null }).eq("id", user.id)
    }
    await requestPayout(user.id, rawAmount)
    redirect("/driver/settlements")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
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
              <CardDescription>출금요청</CardDescription>
              <CardTitle className="text-2xl">{completedSettlements.length}건</CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full" disabled={availableBalance <= 0}>
                    출금요청
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>출금요청</DialogTitle>
                    <DialogDescription>계좌 정보를 입력한 뒤 요청하세요.</DialogDescription>
                  </DialogHeader>
                  <form action={handleRequestPayout} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="bank_name">은행명</Label>
                      <Input id="bank_name" name="bank_name" placeholder="은행명 입력" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account_no">계좌번호</Label>
                      <Input id="account_no" name="account_no" placeholder="계좌번호 입력" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">출금 요청 금액</Label>
                      <Input id="amount" name="amount" type="number" min={0} step="1" placeholder="출금 금액" />
                    </div>
                    <Button type="submit" className="w-full" disabled={availableBalance <= 0}>
                      출금요청
                    </Button>
                    {availableBalance <= 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        출금가능 금액이 0원입니다.
                      </p>
                    )}
                  </form>
                </DialogContent>
              </Dialog>
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


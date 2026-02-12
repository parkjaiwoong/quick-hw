import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getRoleOverride } from "@/lib/role"

type LogRow = {
  id: string
  type: string
  occurred_at: string
  amount: number
  driver_name: string
}

export default async function AdminFinanceLogsPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  const { data: settlements } = await supabase
    .from("settlements")
    .select("id, settlement_amount, settlement_status, updated_at, driver:profiles!settlements_driver_id_fkey(full_name, email)")
    .in("settlement_status", ["CONFIRMED", "PAID_OUT"])
    .order("updated_at", { ascending: false })
    .limit(200)

  const { data: payouts } = await supabase
    .from("payout_requests")
    .select("id, requested_amount, status, processed_at, driver:profiles!payout_requests_driver_id_fkey(full_name, email)")
    .in("status", ["approved", "transferred", "failed", "canceled", "rejected"])
    .order("processed_at", { ascending: false })
    .limit(200)

  const logs: LogRow[] = [
    ...(settlements || []).map((settlement: any) => ({
      id: settlement.id,
      type: settlement.settlement_status === "PAID_OUT" ? "정산 확정(출금 반영)" : "정산 확정",
      occurred_at: settlement.updated_at,
      amount: Number(settlement.settlement_amount || 0),
      driver_name: settlement.driver?.full_name || settlement.driver?.email || "기사",
    })),
    ...(payouts || []).map((payout: any) => ({
      id: payout.id,
      type:
        payout.status === "transferred"
          ? "이체 완료"
          : payout.status === "failed"
            ? "이체 실패"
            : payout.status === "canceled" || payout.status === "rejected"
              ? "출금 반려"
              : "출금 승인",
      occurred_at: payout.processed_at || "",
      amount: Number(payout.requested_amount || 0),
      driver_name: payout.driver?.full_name || payout.driver?.email || "기사",
    })),
  ]
    .filter((log) => log.occurred_at)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">금액 액션 로그</h1>
          <p className="text-muted-foreground mt-1">정산 확정/출금 처리/반려 기록을 확인합니다</p>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">로그 보관 정책</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            로그는 수정/삭제가 불가능하며, 시간순으로 조회됩니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>액션 로그</CardTitle>
            <CardDescription>시간 · 관리자 · 금액 · 대상 기사 정보를 보여줍니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">로그가 없습니다</p>
            ) : (
              logs.map((log) => (
                <div key={`${log.type}-${log.id}`} className="border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{log.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.occurred_at).toLocaleString("ko-KR")}
                    </p>
                    <p className="text-xs text-muted-foreground">대상 기사: {log.driver_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">관리자: {profile?.full_name || "관리자"}</p>
                    <p className="text-lg font-semibold">{log.amount.toLocaleString()}원</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

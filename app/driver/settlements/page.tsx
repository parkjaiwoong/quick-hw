import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDriverSettlements } from "@/lib/actions/settlement"
import { ensureDriverInfoForUser } from "@/lib/actions/driver"
import { getRoleOverride } from "@/lib/role"
import { DollarSign, Calendar, CheckCircle } from "lucide-react"

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

  const totalEarnings = settlements.reduce((sum: number, s: any) => sum + (s.net_earnings || 0), 0)
  const completedSettlements = settlements.filter((s: any) => s.status === "completed")

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">정산 내역</h1>
            <p className="text-muted-foreground mt-1">나의 정산 내역을 확인하세요</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>총 정산 금액</CardDescription>
              <CardTitle className="text-2xl">{totalEarnings.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>완료된 정산</CardDescription>
              <CardTitle className="text-2xl">{completedSettlements.length}건</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>전체 정산</CardDescription>
              <CardTitle className="text-2xl">{settlements.length}건</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar className="h-4 w-4 text-muted-foreground" />
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
                          {new Date(settlement.settlement_period_start).toLocaleDateString("ko-KR")} ~{" "}
                          {new Date(settlement.settlement_period_end).toLocaleDateString("ko-KR")}
                        </p>
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
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            settlement.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : settlement.status === "processing"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {settlement.status === "completed"
                            ? "완료"
                            : settlement.status === "processing"
                              ? "처리 중"
                              : "대기 중"}
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


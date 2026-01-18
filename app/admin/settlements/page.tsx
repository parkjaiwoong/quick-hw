import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getAllSettlements } from "@/lib/actions/settlement"
import { confirmSettlement } from "@/lib/actions/finance"
import Link from "next/link"
import { DollarSign, Calendar, CheckCircle, Clock } from "lucide-react"
import { getRoleOverride } from "@/lib/role"

export default async function SettlementsPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  const { settlements = [] } = await getAllSettlements()

  const stats = {
    total: settlements.length,
    pending: settlements.filter((s: any) => s.status === "pending").length,
    processing: settlements.filter((s: any) => s.status === "processing").length,
    completed: settlements.filter((s: any) => s.status === "completed").length,
    totalAmount: settlements.reduce((sum: number, s: any) => sum + (s.net_earnings || 0), 0),
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">정산 관리</h1>
            <p className="text-muted-foreground mt-1">배송원 정산을 관리하세요</p>
          </div>
          <Button asChild>
            <Link href="/admin/settlements/new">새 정산 생성</Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>전체 정산</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>대기 중</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
            <CardContent>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>처리 중</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{stats.processing}</CardTitle>
            </CardHeader>
            <CardContent>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>완료</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.completed}</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>정산 목록</CardTitle>
            <CardDescription>모든 정산 내역을 확인하세요</CardDescription>
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
                          {settlement.driver?.full_name || settlement.driver?.email || "알 수 없음"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          기간: {new Date(settlement.settlement_period_start).toLocaleDateString("ko-KR")} ~{" "}
                          {new Date(settlement.settlement_period_end).toLocaleDateString("ko-KR")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          배송 건수: {settlement.total_deliveries}건 | 정산 금액:{" "}
                          {settlement.net_earnings?.toLocaleString()}원
                        </p>
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
                        {settlement.settlement_status === "PENDING" && (
                          <form
                            action={async () => {
                              "use server"
                              await confirmSettlement(settlement.id)
                            }}
                          >
                            <Button size="sm" className="mt-2">
                              정산 확정
                            </Button>
                          </form>
                        )}
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


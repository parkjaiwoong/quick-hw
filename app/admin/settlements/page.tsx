import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getAllSettlements } from "@/lib/actions/settlement"
import Link from "next/link"
import { DollarSign, Calendar, CheckCircle, Clock } from "lucide-react"
import { getRoleOverride } from "@/lib/role"
import { SettlementBulkPanel } from "@/components/admin/settlement-bulk-panel"

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
            <SettlementBulkPanel settlements={settlements} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


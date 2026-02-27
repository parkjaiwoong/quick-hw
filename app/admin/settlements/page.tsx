import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getSettlementsByDriver } from "@/lib/actions/settlement"
import Link from "next/link"
import { Users, DollarSign, CheckCircle, Clock } from "lucide-react"
import { getRoleOverride } from "@/lib/role"
import { SettlementDriverList } from "@/components/admin/settlement-driver-list"

export default async function SettlementsPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) redirect("/")

  const { driverGroups = [], error } = await getSettlementsByDriver()

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  const totalDrivers = driverGroups.length
  const totalPaidAmount = driverGroups.reduce((s, g) => s + g.paid_amount, 0)
  const totalPendingAmount = driverGroups.reduce((s, g) => s + g.pending_amount, 0)
  const totalCount = driverGroups.reduce((s, g) => s + g.total_count, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">정산 관리</h1>
            <p className="text-muted-foreground mt-1">배송원 정산을 관리하세요</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/settlements/new">정산 안내</Link>
          </Button>
        </div>

        {/* Stats 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>기사 수</CardDescription>
              <CardTitle className="text-2xl">{totalDrivers}명</CardTitle>
            </CardHeader>
            <CardContent>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>전체 배송 건수</CardDescription>
              <CardTitle className="text-2xl">{totalCount}건</CardTitle>
            </CardHeader>
            <CardContent>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>결제완료 정산금액</CardDescription>
              <CardTitle className="text-2xl text-emerald-600">
                {totalPaidAmount.toLocaleString()}원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>정산대기 금액</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">
                {totalPendingAmount.toLocaleString()}원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </CardContent>
          </Card>
        </div>

        {/* 기사별 정산 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>기사별 정산 목록</CardTitle>
            <CardDescription>기사를 클릭하면 상세 정산 내역을 확인할 수 있습니다</CardDescription>
          </CardHeader>
          <CardContent>
            <SettlementDriverList driverGroups={driverGroups} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

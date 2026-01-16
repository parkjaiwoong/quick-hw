import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getPointBalance, getPointHistory } from "@/lib/actions/points"
import { Coins, TrendingUp, History } from "lucide-react"
import { getRoleOverride } from "@/lib/role"

export default async function PointsPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const roleOverride = await getRoleOverride()
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) {
    redirect("/")
  }

  const { balance } = await getPointBalance(user.id)
  const { history = [] } = await getPointHistory(user.id)

  const earnedPoints = history.filter((h: any) => h.point_type === "earned").length
  const usedPoints = history.filter((h: any) => h.point_type === "used").length

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">포인트</h1>
            <p className="text-muted-foreground mt-1">포인트를 확인하고 사용하세요</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>보유 포인트</CardDescription>
              <CardTitle className="text-3xl">{balance.toLocaleString()}P</CardTitle>
            </CardHeader>
            <CardContent>
              <Coins className="h-4 w-4 text-yellow-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>적립 횟수</CardDescription>
              <CardTitle className="text-2xl">{earnedPoints}회</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>사용 횟수</CardDescription>
              <CardTitle className="text-2xl">{usedPoints}회</CardTitle>
            </CardHeader>
            <CardContent>
              <History className="h-4 w-4 text-blue-600" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>포인트 내역</CardTitle>
            <CardDescription>포인트 적립 및 사용 내역을 확인하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">포인트 내역이 없습니다</p>
              ) : (
                history.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {item.point_type === "earned" ? "적립" : item.point_type === "used" ? "사용" : "만료"}
                        </p>
                        <p className="text-sm text-muted-foreground">{item.description || "포인트"}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(item.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-semibold ${
                            item.point_type === "earned" ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {item.point_type === "earned" ? "+" : "-"}
                          {item.points.toLocaleString()}P
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


import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getAccidentReports } from "@/lib/actions/accident"
import { AlertTriangle, CheckCircle, Clock, XCircle, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AccidentManagementList } from "@/components/admin/accident-management-list"
import { getRoleOverride } from "@/lib/role"

export default async function AccidentsPage() {
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

  const { accidents = [], error } = await getAccidentReports()

  const stats = {
    total: accidents.length,
    reported: accidents.filter((a: any) => a.status === "reported").length,
    investigating: accidents.filter((a: any) => a.status === "investigating").length,
    resolved: accidents.filter((a: any) => a.status === "resolved").length,
    closed: accidents.filter((a: any) => a.status === "closed").length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">사고 처리 관리</h1>
            <p className="text-muted-foreground mt-1">
              접수 목록, 증빙 확인, 보험 처리 여부 체크, 상태 변경
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>전체 사고</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>접수됨</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{stats.reported}</CardTitle>
            </CardHeader>
            <CardContent>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>조사 중</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{stats.investigating}</CardTitle>
            </CardHeader>
            <CardContent>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>해결됨</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.resolved}</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>종료</CardDescription>
              <CardTitle className="text-2xl text-gray-600">{stats.closed}</CardTitle>
            </CardHeader>
            <CardContent>
              <XCircle className="h-4 w-4 text-gray-600" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              사고 접수 목록
            </CardTitle>
            <CardDescription>
              증빙 확인, 보험 처리 여부 체크, 상태 변경 (접수 → 검토 → 완료)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                {error}
              </div>
            ) : (
              <AccidentManagementList accidents={accidents} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

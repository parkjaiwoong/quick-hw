import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Users, FileText, Shield, MessageSquare } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import AdminDashboardTabs from "@/components/admin/admin-dashboard-tabs"

export default async function AdminDashboard() {
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

  const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : supabase

  // 통계 데이터 (관리자용은 service role로 조회)
  const { count: totalDeliveries } = await supabaseAdmin
    .from("deliveries")
    .select("id", { count: "exact", head: true })

  const { count: activeDeliveries } = await supabaseAdmin
    .from("deliveries")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "accepted", "picked_up", "in_transit"])

  const { count: customers } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "customer")

  const { count: drivers } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "driver")

  const { count: accidents } = await supabaseAdmin
    .from("accident_reports")
    .select("id", { count: "exact", head: true })
    .in("status", ["reported", "investigating"])

  const { count: inquiries } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "inquiry")
    .eq("is_read", false)

  const { data: recentAccidents, error: recentAccidentsError } = await supabaseAdmin
    .from("accident_reports")
    .select("id, accident_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: recentInquiries } = await supabaseAdmin
    .from("notifications")
    .select("id, title, message, created_at, is_read")
    .eq("type", "inquiry")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: recentDeliveries, error: recentDeliveriesError } = await supabaseAdmin
    .from("deliveries")
    .select("id, pickup_address, delivery_address, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">관리자 / CS 대시보드</h1>
            <p className="text-muted-foreground mt-1">플랫폼 관리 및 CS 응대</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>전체 배송</CardDescription>
              <CardTitle className="text-2xl">{totalDeliveries ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>진행 중</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{activeDeliveries ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-blue-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>고객</CardDescription>
              <CardTitle className="text-2xl">{customers ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Users className="h-4 w-4 text-purple-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>배송원</CardDescription>
              <CardTitle className="text-2xl">{drivers ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Users className="h-4 w-4 text-orange-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>사고 접수</CardDescription>
              <CardTitle className="text-2xl text-red-600">{accidents ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Shield className="h-4 w-4 text-red-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>미처리 문의</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{inquiries ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageSquare className="h-4 w-4 text-yellow-600" />
            </CardContent>
          </Card>
        </div>

        <AdminDashboardTabs
          recentDeliveries={recentDeliveries}
          recentDeliveriesError={recentDeliveriesError?.message}
          recentAccidents={recentAccidents}
          recentAccidentsError={recentAccidentsError?.message}
          recentInquiries={recentInquiries}
        />
      </div>
    </div>
  )
}

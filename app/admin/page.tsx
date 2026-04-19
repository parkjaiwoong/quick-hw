import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getCachedAuthUser, getCachedProfileRow } from "@/lib/cache/server-session"
import { redirect } from "next/navigation"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Users, Shield, MessageSquare, Calculator, Banknote, Building2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import { getAdminAlertCounts } from "@/lib/actions/finance"
import AdminDashboardTabs from "@/components/admin/admin-dashboard-tabs"
import { AdminAlertBanner } from "@/components/admin/admin-alert-banner"
import { fetchAdminDashboardBundleRpc } from "@/lib/actions/page-bundle-rpc"

export default async function AdminDashboard() {
  const user = await getCachedAuthUser()
  if (!user) {
    redirect("/auth/login")
  }

  const [profile, roleOverride] = await Promise.all([
    getCachedProfileRow(user.id),
    getRoleOverride(),
  ])
  const dashRpc = await fetchAdminDashboardBundleRpc(roleOverride)

  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  const supabase = await getSupabaseServerClient()
  const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : supabase

  let totalDeliveries: number | null
  let activeDeliveries: number | null
  let customers: number | null
  let drivers: number | null
  let accidents: number | null
  let inquiries: number | null
  let recentAccidents: unknown
  let recentInquiries: unknown
  let recentDeliveries: unknown
  let alertCounts: Awaited<ReturnType<typeof getAdminAlertCounts>>

  if (dashRpc.ok) {
    const b = dashRpc.data
    totalDeliveries = b.totalDeliveries
    activeDeliveries = b.activeDeliveries
    customers = b.customers
    drivers = b.drivers
    accidents = b.accidents
    inquiries = b.inquiries
    recentAccidents = b.recentAccidents
    recentInquiries = b.recentInquiries
    recentDeliveries = b.recentDeliveries
    alertCounts = {
      pendingSettlementCount: b.pendingSettlementCount,
      pendingPayoutCount: b.pendingPayoutCount,
      pendingPayoutAmount: b.pendingPayoutAmount,
    }
  } else {
    ;[
      { count: totalDeliveries },
      { count: activeDeliveries },
      { count: customers },
      { count: drivers },
      { count: accidents },
      { count: inquiries },
      { data: recentAccidents },
      { data: recentInquiries },
      { data: recentDeliveries },
      alertCounts,
    ] = await Promise.all([
      supabaseAdmin.from("deliveries").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("deliveries").select("id", { count: "exact", head: true }).in("status", ["pending", "accepted", "picked_up", "in_transit"]),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "driver"),
      supabaseAdmin.from("accident_reports").select("id", { count: "exact", head: true }).in("status", ["reported", "investigating"]),
      supabaseAdmin.from("notifications").select("id", { count: "exact", head: true }).eq("type", "inquiry").eq("is_read", false),
      supabaseAdmin.from("accident_reports").select("id, accident_type, status, created_at").order("created_at", { ascending: false }).limit(5),
      supabaseAdmin.from("notifications").select("id, title, message, created_at, is_read").eq("type", "inquiry").order("created_at", { ascending: false }).limit(5),
      supabaseAdmin.from("deliveries").select("id, pickup_address, delivery_address, status, created_at").order("created_at", { ascending: false }).limit(5),
      getAdminAlertCounts(),
    ])
  }
  const countsForBanner =
    "error" in alertCounts
      ? { pendingSettlementCount: 0, pendingPayoutCount: 0, pendingPayoutAmount: 0, unreadInquiries: inquiries ?? 0, openAccidents: accidents ?? 0 }
      : {
          ...alertCounts,
          unreadInquiries: inquiries ?? 0,
          openAccidents: accidents ?? 0,
        }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">관리자 / CS 대시보드</h1>
            <p className="text-muted-foreground mt-1">플랫폼 관리 및 CS 응대</p>
          </div>
        </div>

        <AdminAlertBanner counts={countsForBanner} />

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
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

          <Link href="/admin/settlements" className="block transition hover:opacity-90">
            <Card className={countsForBanner.pendingSettlementCount > 0 ? "ring-2 ring-amber-400" : ""}>
              <CardHeader className="pb-2">
                <CardDescription>정산 대기</CardDescription>
                <CardTitle className="text-2xl text-amber-600">{countsForBanner.pendingSettlementCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <Calculator className="h-4 w-4 text-amber-600" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/payouts" className="block transition hover:opacity-90">
            <Card className={countsForBanner.pendingPayoutCount > 0 ? "ring-2 ring-amber-400" : ""}>
              <CardHeader className="pb-2">
                <CardDescription>출금 대기</CardDescription>
                <CardTitle className="text-2xl text-amber-600">{countsForBanner.pendingPayoutCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <Banknote className="h-4 w-4 text-amber-600" />
              </CardContent>
            </Card>
          </Link>

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

        {/* 회사 정보 관리 */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              회사 정보 관리
            </CardTitle>
            <CardDescription>로고·도장 이미지, 회사명, 사업자 정보를 관리합니다. 저장 즉시 헤더·영수증에 반영됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/company">회사 정보 관리하기</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>결제 · 정산 · 출금 관리</CardTitle>
            <CardDescription>고객 결제, 기사 정산, 기사 출금 요청을 한곳에서 처리합니다</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Button asChild variant="outline" className="flex-1 min-w-[120px]">
              <Link href="/admin/payments">결제 관리</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 min-w-[120px]">
              <Link href="/admin/settlements">정산 관리</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 min-w-[120px]">
              <Link href="/admin/payouts">출금(지급) 관리</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 min-w-[120px]">
              <Link href="/admin/finance-logs">금액 액션 로그</Link>
            </Button>
          </CardContent>
        </Card>

        <AdminDashboardTabs
          recentDeliveries={recentDeliveries}
          recentAccidents={recentAccidents}
          recentInquiries={recentInquiries}
        />
      </div>
    </div>
  )
}

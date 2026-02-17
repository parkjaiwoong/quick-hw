import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, Star, TrendingUp, History, Smartphone } from "lucide-react"
import { AvailableDeliveries } from "@/components/driver/available-deliveries"
import { AssignedDeliveries } from "@/components/driver/assigned-deliveries"
import { DriverStatusToggle } from "@/components/driver/driver-status-toggle"
import { ensureDriverInfoForUser, getAvailableDeliveries, getMyAssignedDeliveries, getDriverInfo } from "@/lib/actions/driver"
import { getRoleOverride } from "@/lib/role"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RealtimeDeliveryNotifications } from "@/components/driver/realtime-delivery-notifications"
import { DriverDashboardPoller } from "@/components/driver/driver-dashboard-poller"

export default async function DriverDashboard() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let riderCode: string | null = null
  if (serviceRoleKey) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)
    const { data: riderRow } = await supabaseService
      .from("riders")
      .select("code")
      .eq("id", user.id)
      .maybeSingle()
    riderCode = riderRow?.code ?? null
  }

  const roleOverride = await getRoleOverride()
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) {
    redirect("/")
  }

  if (canActAsDriver) {
    await ensureDriverInfoForUser()
  }

  const { driverInfo } = await getDriverInfo()
  const { deliveries: available = [] } = await getAvailableDeliveries()
  const { deliveries: assigned = [] } = await getMyAssignedDeliveries()

  // 전체 운행 이력
  const { data: allDeliveries } = await supabase
    .from("deliveries")
    .select("id, status, created_at, delivered_at, customer_rating")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  // 사고 발생 여부 확인
  const { data: accidents } = await supabase
    .from("accident_reports")
    .select("id, status, accident_type")
    .eq("driver_id", user.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <RealtimeDeliveryNotifications userId={user.id} isAvailable={driverInfo?.is_available ?? false} />
      <DriverDashboardPoller />
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">배송원 대시보드</h1>
            <p className="text-muted-foreground mt-1">{profile?.full_name}님, 안전 운행하세요</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2 flex-wrap">
              <Button asChild variant="outline" size="sm">
                <Link href="/driver/wallet">적립금 지갑 · 출금</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/driver/settlements">정산 내역</Link>
              </Button>
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/driver/app-download" className="flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" />
                  기사 앱 다운로드
                </Link>
              </Button>
            </div>
            <DriverStatusToggle initialStatus={driverInfo?.is_available || false} />
            <Card className="w-full md:w-auto">
              <CardHeader className="pb-2">
                <CardDescription>기사 코드</CardDescription>
                <CardTitle className="text-lg">{riderCode || "미등록"}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                기사 ID: {user.id}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>평점</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-1">
                {driverInfo?.rating?.toFixed(1) || "5.0"}
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{driverInfo?.total_deliveries || 0}건 완료</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>진행 중</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{assigned.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>대기 배송</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{available.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-yellow-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>사고 발생</CardDescription>
              <CardTitle className="text-3xl text-red-600">{accidents?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-red-600" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="available" className="w-full">
          <div className="w-full">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">탭 메뉴</p>
            <TabsList className="tabs-scroll-mobile inline-flex w-full max-w-full h-auto min-h-[2.75rem] gap-1.5 rounded-xl border border-border bg-muted/50 py-1.5 pl-[max(0.75rem,env(safe-area-inset-left))] pr-1.5 shadow-sm overflow-x-auto overflow-y-hidden">
              <TabsTrigger value="available" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">대기 중 배송 ({available.length})</TabsTrigger>
              <TabsTrigger value="assigned" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">진행 중 배송 ({assigned.length})</TabsTrigger>
              <TabsTrigger value="history" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">운행 이력</TabsTrigger>
              <TabsTrigger value="settlements" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">정산</TabsTrigger>
              <TabsTrigger value="sales" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">📊 영업 성과</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="available" className="mt-4">
            <Card>
              <CardHeader> 
                <CardTitle>수락 가능한 배송</CardTitle>
                <CardDescription>새로운 배송 요청을 확인하고 수락하세요</CardDescription>
              </CardHeader>
              <CardContent>
                {driverInfo?.is_available ? (
                  <AvailableDeliveries deliveries={available} />
                ) : (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    배송 가능을 켜면 고객 요청 목록이 표시됩니다.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assigned" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>진행 중인 배송</CardTitle>
                <CardDescription>현재 담당하고 있는 배송 건입니다</CardDescription>
              </CardHeader>
              <CardContent>
                <AssignedDeliveries deliveries={assigned} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  운행 이력
                </CardTitle>
                <CardDescription>최근 운행 내역을 확인하세요</CardDescription>
              </CardHeader>
              <CardContent>
                {allDeliveries && allDeliveries.length > 0 ? (
                  <div className="space-y-3">
                    {allDeliveries.map((delivery) => (
                      <div key={delivery.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {new Date(delivery.created_at).toLocaleDateString("ko-KR")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              상태: {delivery.status === "delivered" ? "완료" : delivery.status}
                            </p>
                            {delivery.customer_rating && (
                              <p className="text-sm text-yellow-600">
                                평점: {delivery.customer_rating}점
                              </p>
                            )}
                          </div>
                          <Link href={`/driver/delivery/${delivery.id}`}>
                            <Button variant="outline" size="sm">
                              상세보기
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">운행 이력이 없습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settlements" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>정산</CardTitle>
                <CardDescription>정산 내역과 출금 요청은 정산 화면에서 관리합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/driver/settlements">정산 화면 이동</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>📊 영업 성과</CardTitle>
                <CardDescription>소개 고객과 추가 수익을 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/driver/dashboard">영업 성과 대시보드 보기</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, Star, TrendingUp, History } from "lucide-react"
import { AvailableDeliveries } from "@/components/driver/available-deliveries"
import { AssignedDeliveries } from "@/components/driver/assigned-deliveries"
import { DriverStatusToggle } from "@/components/driver/driver-status-toggle"
import { ensureDriverInfoForUser, getAvailableDeliveries, getMyAssignedDeliveries, getDriverInfo } from "@/lib/actions/driver"
import { getRoleOverride } from "@/lib/role"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RealtimeDeliveryNotifications } from "@/components/driver/realtime-delivery-notifications"

export default async function DriverDashboard() {
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
      <RealtimeDeliveryNotifications userId={user.id} />
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">배송원 대시보드</h1>
            <p className="text-muted-foreground mt-1">{profile?.full_name}님, 안전 운행하세요</p>
          </div>
          <DriverStatusToggle initialStatus={driverInfo?.is_available || false} />
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="available">대기 중 배송 ({available.length})</TabsTrigger>
            <TabsTrigger value="assigned">진행 중 배송 ({assigned.length})</TabsTrigger>
            <TabsTrigger value="history">운행 이력</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-6">
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

          <TabsContent value="assigned" className="mt-6">
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

          <TabsContent value="history" className="mt-6">
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
        </Tabs>
      </div>
    </div>
  )
}

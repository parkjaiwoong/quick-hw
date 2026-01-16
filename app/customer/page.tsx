import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { Package, MapPin, Shield, AlertCircle } from "lucide-react"
import { DeliveryList } from "@/components/customer/delivery-list"
import { getMyDeliveries } from "@/lib/actions/deliveries"
import { getRoleOverride } from "@/lib/role"

export default async function CustomerDashboard() {
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

  const { deliveries = [] } = await getMyDeliveries()

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === "pending").length,
    inProgress: deliveries.filter((d) => ["accepted", "picked_up", "in_transit"].includes(d.status)).length,
    completed: deliveries.filter((d) => d.status === "delivered").length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* 메인 메시지 */}
        <div className="text-center space-y-4 py-8">
          <h1 className="text-4xl md:text-5xl font-bold text-balance">
            가까운 퀵 기사 빠르게 연결
          </h1>
          <p className="text-xl text-muted-foreground">
            물품 파손·분실 시 보험 처리
          </p>
        </div>

        {/* 법적 고지 */}
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>중요 안내:</strong> 본 플랫폼은 운송 당사자가 아닌 중개 플랫폼입니다. 
            요금은 카카오픽 기준으로 자동 산정됩니다. 
            <Link href="/terms" className="underline ml-1">약관 보기</Link>
          </AlertDescription>
        </Alert>

        {/* 배송 요청 버튼 */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              새 배송 요청하기
            </CardTitle>
            <CardDescription>
              출발지와 도착지를 입력하고 가까운 기사를 연결받으세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full md:w-auto">
              <Link href="/customer/new-delivery">
                <Package className="mr-2 h-5 w-5" />
                기사 연결 요청
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>전체 배송</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>대기 중</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-yellow-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>진행 중</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.inProgress}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-blue-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>완료</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.completed}</CardTitle>
            </CardHeader>
            <CardContent>
              <Package className="h-4 w-4 text-green-600" />
            </CardContent>
          </Card>
        </div>

        {/* 배송 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>내 배송 목록</CardTitle>
            <CardDescription>최근 배송 내역을 확인하고 관리하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <DeliveryList deliveries={deliveries} />
          </CardContent>
        </Card>

        {/* 문의/사고 접수 */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                일반 문의
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/customer/inquiry">문의하기</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-600" />
                물품 사고 접수
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/customer/accident">사고 접수하기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

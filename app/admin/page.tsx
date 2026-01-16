import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, Users, FileText, Shield, MessageSquare } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"

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

  // 통계 데이터
  const { count: totalDeliveries } = await supabase
    .from("deliveries")
    .select("id", { count: "exact", head: true })

  const { count: activeDeliveries } = await supabase
    .from("deliveries")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "accepted", "picked_up", "in_transit"])

  const { count: customers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "customer")

  const { count: drivers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "driver")

  const { count: accidents } = await supabase
    .from("accident_reports")
    .select("id", { count: "exact", head: true })
    .in("status", ["reported", "investigating"])

  const { count: inquiries } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "inquiry")
    .eq("is_read", false)

  const { data: recentAccidents, error: recentAccidentsError } = await supabase
    .from("accident_reports")
    .select("id, accident_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: recentInquiries } = await supabase
    .from("notifications")
    .select("id, title, message, created_at, is_read")
    .eq("type", "inquiry")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: recentDeliveries, error: recentDeliveriesError } = await supabase
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

        <Tabs defaultValue="logs" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="logs">주문 & 연결 로그</TabsTrigger>
            <TabsTrigger value="accidents">사고 처리 관리</TabsTrigger>
            <TabsTrigger value="cs">CS 응대</TabsTrigger>
            <TabsTrigger value="rewards">리워드 관리</TabsTrigger>
            <TabsTrigger value="pricing">가격 정책</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>주문 & 연결 로그</CardTitle>
                <CardDescription>
                  누가 언제 누구와 연결됐는지, 통화 여부, 사고 발생 여부를 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentDeliveriesError ? (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                    주문 로그를 불러오지 못했습니다: {recentDeliveriesError.message}
                  </div>
                ) : recentDeliveries && recentDeliveries.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {recentDeliveries.map((delivery: any) => (
                      <div key={delivery.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {delivery.pickup_address} → {delivery.delivery_address}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(delivery.created_at).toLocaleString("ko-KR")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          상태:{" "}
                          {delivery.status === "pending"
                            ? "대기"
                            : delivery.status === "accepted"
                              ? "수락"
                              : delivery.status === "picked_up"
                                ? "픽업"
                                : delivery.status === "in_transit"
                                  ? "배송중"
                                  : delivery.status === "delivered"
                                    ? "완료"
                                    : delivery.status === "cancelled"
                                      ? "취소"
                                      : delivery.status}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">주문 로그가 없습니다.</p>
                )}
                <Link href="/admin/dispatch">
                  <Button className="w-full">연결 로그 상세 보기</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accidents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>사고 처리 관리</CardTitle>
                <CardDescription>
                  접수 목록, 증빙 확인, 보험 처리 여부 체크, 상태 변경
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentAccidentsError ? (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                    사고 접수 테이블이 아직 생성되지 않았습니다. Supabase에서
                    {" "}scripts/006_additional_features.sql{" "}을 실행해주세요.
                  </div>
                ) : recentAccidents && recentAccidents.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {recentAccidents.map((accident: any) => (
                      <div key={accident.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium">
                            사고 #{accident.id.slice(0, 8)} ·{" "}
                            {accident.accident_type === "damage" ? "물품 파손" : "물품 분실"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(accident.created_at).toLocaleString("ko-KR")}
                          </p>
                        </div>
                        <span className="text-xs rounded px-2 py-1 bg-muted">
                          {accident.status === "reported"
                            ? "접수"
                            : accident.status === "investigating"
                              ? "조사중"
                              : accident.status === "resolved"
                                ? "해결"
                                : "종료"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">최근 사고 접수가 없습니다.</p>
                )}
                <Link href="/admin/accidents">
                  <Button className="w-full">사고 처리 상세 보기</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cs" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>CS 응대</CardTitle>
                <CardDescription>
                  문의 목록, AI 1차 답변 기록, 필요 시 수동 응답
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentInquiries && recentInquiries.length > 0 ? (
                    <div className="space-y-3">
                      {recentInquiries.map((inquiry: any) => (
                        <div key={inquiry.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{inquiry.title || "제목 없음"}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(inquiry.created_at).toLocaleString("ko-KR")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">{inquiry.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      최근 문의가 없습니다. 현재는 문의사항을 직접 확인하실 수 있습니다.
                    </p>
                  )}
                  <Link href="/admin/inquiries">
                    <Button className="w-full">문의 목록 보기</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="rewards" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>리워드 관리</CardTitle>
                <CardDescription>정책/이력/포인트 관리 화면으로 이동합니다</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Button asChild variant="outline">
                  <Link href="/admin/reward-policy">기본 리워드 정책</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/rider-reward-policy">기사별 리워드 %</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/event-policy">이벤트 리워드 관리</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/rider-rewards">주문별 리워드 정산</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/point-history">고객 포인트 내역</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/point-redemptions">포인트 교환 요청</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/referrals">고객 소개 현황</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="pricing" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>가격 정책</CardTitle>
                <CardDescription>카카오픽 기준 자동 산정 정책을 관리합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/pricing">
                  <Button className="w-full">가격 정책 설정</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

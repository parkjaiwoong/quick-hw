import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Phone, AlertTriangle, CheckCircle } from "lucide-react"
import { getRoleOverride } from "@/lib/role"

export default async function DispatchPage() {
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

  // 주문 & 연결 로그 가져오기
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select(`
      id,
      created_at,
      status,
      pickup_address,
      delivery_address,
      customer_id,
      driver_id,
      profiles!deliveries_customer_id_fkey(full_name, email),
      profiles!deliveries_driver_id_fkey(full_name, email)
    `)
    .order("created_at", { ascending: false })
    .limit(100)

  // 사고 발생 여부 확인
  const { data: accidents } = await supabase
    .from("accident_reports")
    .select("delivery_id, status")
    .in("delivery_id", deliveries?.map((d: any) => d.id) || [])

  const accidentMap = new Map(
    accidents?.map((a: any) => [a.delivery_id, a.status]) || []
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">주문 & 연결 로그</h1>
            <p className="text-muted-foreground mt-1">
              누가 언제 누구와 연결됐는지, 통화 여부, 사고 발생 여부를 확인하세요
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>연결 로그</CardTitle>
            <CardDescription>법적 분쟁 대비 핵심 자료</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>요청 시간</TableHead>
                  <TableHead>고객</TableHead>
                  <TableHead>기사</TableHead>
                  <TableHead>출발지 → 도착지</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>통화 여부</TableHead>
                  <TableHead>사고 발생</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries && deliveries.length > 0 ? (
                  deliveries.map((delivery: any) => {
                    const hasAccident = accidentMap.has(delivery.id)
                    const accidentStatus = accidentMap.get(delivery.id)

                    return (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          {new Date(delivery.created_at).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell>
                          {delivery.profiles?.full_name || delivery.profiles?.email || "알 수 없음"}
                        </TableCell>
                        <TableCell>
                          {delivery.driver_id ? (
                            delivery.profiles?.full_name || delivery.profiles?.email || "알 수 없음"
                          ) : (
                            <Badge variant="outline">미연결</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {delivery.pickup_address} → {delivery.delivery_address}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              delivery.status === "delivered"
                                ? "default"
                                : delivery.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                            }
                          >
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
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {delivery.driver_id ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <Phone className="h-4 w-4" />
                              <span className="text-xs">연결됨</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">미연결</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasAccident ? (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="h-4 w-4" />
                              <Badge variant="destructive" className="text-xs">
                                {accidentStatus === "reported"
                                  ? "접수"
                                  : accidentStatus === "investigating"
                                  ? "조사중"
                                  : accidentStatus === "resolved"
                                  ? "해결"
                                  : "종료"}
                              </Badge>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">정상</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">연결 로그가 없습니다</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

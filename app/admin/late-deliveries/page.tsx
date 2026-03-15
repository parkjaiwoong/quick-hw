import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getRoleOverride } from "@/lib/role"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getLateDeliveries } from "@/lib/actions/admin"
import { Clock, AlertTriangle } from "lucide-react"

export default async function LateDeliveriesPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: profile }, roleOverride] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
  ])
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) redirect("/")

  const result = await getLateDeliveries()
  if (result?.error) {
    return (
      <div className="p-6">
        <p className="text-destructive">{result.error}</p>
      </div>
    )
  }
  const deliveries = result.deliveries ?? []

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
            예상시간 초과 배송
          </h1>
          <p className="text-muted-foreground mt-1">
            고객이 선택한 예상 완료 시간을 넘겨 완료된 배송 목록입니다. (급송 30분, 기본 3시간)
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">대시보드로</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>초과 완료 건 ({deliveries.length}건)</CardTitle>
          <CardDescription>
            수락 시각 + 예상시간(분)보다 늦게 배송 완료된 건만 표시됩니다. 기사 교육·평가·보상 정책 참고용으로 활용하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">예상시간을 초과하여 완료된 배송이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>배송 ID</TableHead>
                    <TableHead>완료 일시</TableHead>
                    <TableHead>초과 시간</TableHead>
                    <TableHead>고객</TableHead>
                    <TableHead>기사</TableHead>
                    <TableHead>픽업 → 배송지</TableHead>
                    <TableHead>요금</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        {d.delivered_at
                          ? new Date(d.delivered_at).toLocaleString("ko-KR", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {d.over_minutes}분 초과
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(d.customer as any)?.full_name || (d.customer as any)?.email || "-"}
                      </TableCell>
                      <TableCell>
                        {(d.driver as any)?.full_name || (d.driver as any)?.email || "-"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">
                        {d.pickup_address} → {d.delivery_address}
                      </TableCell>
                      <TableCell>{Number(d.total_fee ?? 0).toLocaleString()}원</TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/dispatch?highlight=${d.id}`}>연결 로그</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

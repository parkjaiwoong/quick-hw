import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import { updateCustomerPoints } from "@/lib/actions/point-history"

export default async function PointHistoryPage({
  searchParams,
}: {
  searchParams?: { q?: string }
}) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  const query = searchParams?.q?.trim()
  let points: any[] = []
  let customers: any[] = []
  let error: { message: string } | null = null

  if (query) {
    const { data: matchedCustomers, error: customerError } = await supabase
      .from("customer")
      .select("id, name, email")
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)

    if (customerError) {
      error = customerError
    } else {
      customers = matchedCustomers || []
      const customerIds = customers.map((c: any) => c.id)
      if (customerIds.length === 0) {
        points = []
      } else {
        const { data: pointRows, error: pointError } = await supabase
          .from("customer_point_history")
          .select("id, customer_id, order_id, points, type, reason, created_at")
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false })
          .limit(200)
        if (pointError) {
          error = pointError
        } else {
          points = pointRows || []
        }
      }
    }
  } else {
    const { data: pointRows, error: pointError } = await supabase
      .from("customer_point_history")
      .select("id, customer_id, order_id, points, type, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200)

    if (pointError) {
      error = pointError
    } else {
      points = pointRows || []
      const customerIds = Array.from(new Set(points.map((p: any) => p.customer_id)))
      if (customerIds.length) {
        const { data: fetchedCustomers } = await supabase
          .from("customer")
          .select("id, name, email")
          .in("id", customerIds)
        customers = fetchedCustomers || []
      }
    }
  }

  const customerMap = new Map((customers || []).map((c: any) => [c.id, c.name || c.email || c.id]))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">고객 포인트 내역</h1>
            <p className="text-muted-foreground mt-1">포인트 적립/사용 내역</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>고객 포인트 이력</CardTitle>
            <CardDescription>적립/사용 내역을 확인합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={updateCustomerPoints} className="grid gap-3 rounded-lg border p-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <label className="text-sm font-medium" htmlFor="customer_target">
                  고객 ID 또는 이메일
                </label>
                <input
                  id="customer_target"
                  name="customer"
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="UUID 또는 email@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="point_type">
                  구분
                </label>
                <select
                  id="point_type"
                  name="type"
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  defaultValue="earn"
                >
                  <option value="earn">적립</option>
                  <option value="use">사용</option>
                  <option value="adjust">조정</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="point_amount">
                  포인트
                </label>
                <input
                  id="point_amount"
                  name="points"
                  type="number"
                  step="0.01"
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="1000"
                />
              </div>
              <div className="md:col-span-5">
                <label className="text-sm font-medium" htmlFor="point_reason">
                  사유
                </label>
                <input
                  id="point_reason"
                  name="reason"
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="사유를 입력하세요 (선택)"
                />
              </div>
              <div className="md:col-span-5 flex justify-end">
                <Button type="submit">포인트 반영</Button>
              </div>
            </form>
            <form action="/admin/point-history" className="flex flex-col gap-2 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium" htmlFor="customer_search">
                  고객 검색
                </label>
                <input
                  id="customer_search"
                  name="q"
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="이름 또는 이메일"
                  defaultValue={query}
                />
              </div>
              <Button type="submit" variant="outline">
                검색
              </Button>
            </form>
            {error ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                데이터를 불러오지 못했습니다: {error.message}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>고객</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead>포인트</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {points && points.length > 0 ? (
                    points.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{customerMap.get(item.customer_id) || item.customer_id}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{Number(item.points || 0).toLocaleString()}P</TableCell>
                        <TableCell>{item.reason || "-"}</TableCell>
                        <TableCell>{new Date(item.created_at).toLocaleString("ko-KR")}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        포인트 이력이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

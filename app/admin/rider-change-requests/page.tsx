import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import { updateRiderChangeRequest } from "@/lib/actions/rider-change"
import { unstable_noStore as noStore } from "next/cache"

export const dynamic = "force-dynamic"

export default async function RiderChangeRequestsPage({
  searchParams,
}: {
  searchParams?: { status?: string; result?: string; action?: string }
}) {
  noStore()
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

  const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : supabase

  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {}
  const statusParam = resolvedSearchParams?.status
  const resultStatus = typeof resolvedSearchParams?.result === "string" ? resolvedSearchParams.result : ""
  const resultAction = typeof resolvedSearchParams?.action === "string" ? resolvedSearchParams.action : ""
  const statusFilter =
    statusParam === "approved"
      ? "approved"
      : statusParam === "rejected"
        ? "denied"
        : statusParam === "pending"
          ? "pending"
          : "all"

  let requestQuery = supabaseAdmin
    .from("rider_change_history")
    .select("id, customer_id, from_rider_id, to_rider_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200)

  if (statusFilter !== "all") {
    requestQuery = requestQuery.eq("status", statusFilter)
  }

  const { data: rows } = await requestQuery

  const riderIds = Array.from(new Set((rows || []).flatMap((r: any) => [r.from_rider_id, r.to_rider_id])))
  const customerIds = Array.from(new Set((rows || []).map((r: any) => r.customer_id)))

  const { data: riderRows } = riderIds.length
    ? await supabaseAdmin.from("riders").select("id, code").in("id", riderIds)
    : { data: [] }
  const { data: customerRows } = customerIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", customerIds)
    : { data: [] }

  const riderMap = new Map((riderRows || []).map((r: any) => [r.id, r.code]))
  const customerMap = new Map((customerRows || []).map((c: any) => [c.id, c.full_name || c.email || c.id]))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">기사 변경 요청</h1>
            <p className="text-muted-foreground mt-1">고객이 요청한 기사 변경 내역</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>요청 목록</CardTitle>
            <CardDescription>승인/거절 처리 후 상태만 업데이트합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {resultStatus === "success" && (
              <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
                <AlertDescription>
                  {resultAction === "approve" ? "승인 처리가 완료되었습니다." : "거절 처리가 완료되었습니다."}
                </AlertDescription>
              </Alert>
            )}
            <form action="/admin/rider-change-requests" className="flex flex-col gap-2 md:flex-row md:items-end mb-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="status">
                  상태
                </label>
                <select
                  id="status"
                  name="status"
                  className="h-10 w-44 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={statusParam || "all"}
                >
                  <option value="all">all</option>
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
              <Button type="submit" variant="outline">
                필터 적용
              </Button>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>요청 시간</TableHead>
                  <TableHead>고객</TableHead>
                  <TableHead>기존 기사</TableHead>
                  <TableHead>변경 기사</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-center">상세 보기</TableHead>
                  <TableHead>처리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows && rows.length > 0 ? (
                  rows.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.created_at).toLocaleString("ko-KR")}</TableCell>
                      <TableCell>{customerMap.get(row.customer_id) || row.customer_id}</TableCell>
                      <TableCell>{riderMap.get(row.from_rider_id) || row.from_rider_id}</TableCell>
                      <TableCell>{riderMap.get(row.to_rider_id) || row.to_rider_id}</TableCell>
                      <TableCell>{row.status === "denied" ? "rejected" : row.status}</TableCell>
                      <TableCell className="text-center">
                        <Button asChild size="sm">
                          <Link href={`/admin/rider-change-requests/${row.id}`}>상세 보기</Link>
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <form action={updateRiderChangeRequest}>
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="action" value="approve" />
                            <input type="hidden" name="redirect_to" value="/admin/rider-change-requests" />
                            <Button size="sm" disabled={row.status !== "pending"}>
                              승인
                            </Button>
                          </form>
                          <form action={updateRiderChangeRequest}>
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="action" value="deny" />
                            <input type="hidden" name="redirect_to" value="/admin/rider-change-requests" />
                            <Button size="sm" variant="outline" disabled={row.status !== "pending"}>
                              거절
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      요청이 없습니다.
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

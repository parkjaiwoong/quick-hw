import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getRoleOverride } from "@/lib/role"
import { unstable_noStore as noStore } from "next/cache"

export const dynamic = "force-dynamic"

export default async function RiderChangeRequestDetailPage({
  searchParams,
}: {
  searchParams?: { id?: string }
}) {
  noStore()
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {}
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) {
    redirect("/")
  }

  const queryId = typeof resolvedSearchParams?.id === "string" ? resolvedSearchParams.id : ""
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    queryId,
  )
  if (isValidUuid) {
    redirect(`/customer/rider-change-request-detail?id=${encodeURIComponent(queryId)}`)
  }

  const { data: requests } = await supabase
    .from("rider_change_history")
    .select("id, customer_id, from_rider_id, to_rider_id, status, reason, admin_reason, cooldown_until, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  let riderCodeMap = new Map<string, string>()

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey && requests && requests.length > 0) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)
    const riderIds = Array.from(
      new Set(requests.flatMap((req: any) => [req.from_rider_id, req.to_rider_id]).filter(Boolean)),
    )
    if (riderIds.length) {
      const { data: riderRows } = await supabaseService.from("riders").select("id, code").in("id", riderIds)
      riderCodeMap = new Map((riderRows || []).map((r: any) => [r.id, r.code]))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">기사 변경 요청 상세</h1>
            <p className="text-muted-foreground mt-1">가장 최근 요청의 처리 상태를 확인합니다.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/customer">고객 대시보드로</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>요청 목록</CardTitle>
            <CardDescription>요청 상세를 확인할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {queryId && (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                상세 이동용 ID가 감지되었습니다.{" "}
                <Link
                  href={`/customer/rider-change-request-detail?id=${encodeURIComponent(queryId)}`}
                  className="underline underline-offset-4"
                >
                  상세로 이동
                </Link>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>요청 시간</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>기존 기사</TableHead>
                  <TableHead>변경 기사</TableHead>
                  <TableHead>거절 사유</TableHead>
                  <TableHead>상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests && requests.length > 0 ? (
                  requests.map((req: any) => (
                    <TableRow key={req.id}>
                      {/** Extract requestId once for link + display */}
                      {(() => {
                        const requestId = typeof req.id === "string" ? req.id : ""
                        return (
                          <>
                      <TableCell>{new Date(req.created_at).toLocaleString("ko-KR")}</TableCell>
                      <TableCell>{req.status === "denied" ? "rejected" : req.status}</TableCell>
                      <TableCell>{riderCodeMap.get(req.from_rider_id) || req.from_rider_id}</TableCell>
                      <TableCell>{riderCodeMap.get(req.to_rider_id) || req.to_rider_id}</TableCell>
                      <TableCell>{req.admin_reason || "-"}</TableCell>
                      <TableCell>
                        {requestId ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/customer/rider-change-request-detail?id=${encodeURIComponent(requestId)}`}>
                              상세
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">상세 불가</span>
                        )}
                      </TableCell>
                          </>
                        )
                      })()}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      요청 내역이 없습니다.
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

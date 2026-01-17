import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getRoleOverride } from "@/lib/role"
import { updateRiderChangeRequest } from "@/lib/actions/rider-change"
import { unstable_noStore as noStore } from "next/cache"

export const dynamic = "force-dynamic"

export default async function RiderChangeRequestAdminDetailPage({
  params,
  searchParams,
}: {
  params: { id?: string }
  searchParams?: { id?: string }
}) {
  noStore()
  const resolvedParams = (await Promise.resolve(params)) ?? {}
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {}
  const routeId = typeof resolvedParams?.id === "string" ? resolvedParams.id : ""
  const queryId = typeof resolvedSearchParams?.id === "string" ? resolvedSearchParams.id : ""
  const resultStatus = typeof resolvedSearchParams?.result === "string" ? resolvedSearchParams.result : ""
  const resultAction = typeof resolvedSearchParams?.action === "string" ? resolvedSearchParams.action : ""
  const requestId = routeId || queryId
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    requestId,
  )
  if (!routeId && queryId && isValidUuid) {
    redirect(`/admin/rider-change-requests/${queryId}`)
  }
  if (!isValidUuid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-balance">기사 변경 요청 상세</h1>
              <p className="text-muted-foreground mt-1">요청 상세 정보와 처리 상태를 확인합니다.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/rider-change-requests">목록으로</Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>요청 정보</CardTitle>
              <CardDescription>요청 상태와 변경 기사 정보를 확인하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>요청 ID가 올바르지 않습니다.</div>
              <div className="text-xs">요청 ID: {requestId || "-"}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
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

  const { data: requestRow } = await supabaseAdmin
    .from("rider_change_history")
    .select("id, customer_id, from_rider_id, to_rider_id, status, reason, admin_reason, cooldown_until, created_at")
    .eq("id", requestId)
    .maybeSingle()

  let riderCodeMap = new Map<string, string>()
  let customerLabel = ""

  if (requestRow) {
    const riderIds = [requestRow.from_rider_id, requestRow.to_rider_id].filter(Boolean)
    if (riderIds.length) {
      const { data: riderRows } = await supabaseAdmin.from("riders").select("id, code").in("id", riderIds)
      riderCodeMap = new Map((riderRows || []).map((r: any) => [r.id, r.code]))
    }

    const { data: customerRow } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", requestRow.customer_id)
      .maybeSingle()
    customerLabel = customerRow?.full_name || customerRow?.email || requestRow.customer_id
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">기사 변경 요청 상세</h1>
            <p className="text-muted-foreground mt-1">요청 상세 정보와 처리 상태를 확인합니다.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/rider-change-requests">목록으로</Link>
          </Button>
        </div>

        {resultStatus === "success" && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <AlertDescription>
              {resultAction === "approve" ? "승인 처리가 완료되었습니다." : "거절 처리가 완료되었습니다."}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>요청 정보</CardTitle>
            <CardDescription>고객 요청 상세와 기사 정보를 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {requestRow ? (
              <>
                <div>요청 시간: {new Date(requestRow.created_at).toLocaleString("ko-KR")}</div>
                <div>고객: {customerLabel}</div>
                <div>상태: {requestRow.status === "denied" ? "rejected" : requestRow.status}</div>
                <div>기존 기사 코드: {riderCodeMap.get(requestRow.from_rider_id) || requestRow.from_rider_id}</div>
                <div>변경 기사 코드: {riderCodeMap.get(requestRow.to_rider_id) || requestRow.to_rider_id}</div>
                <div>변경 사유: {requestRow.reason || "-"}</div>
                <div>거절 사유: {requestRow.admin_reason || "-"}</div>
                {requestRow.cooldown_until && (
                  <div>쿨타임 종료: {new Date(requestRow.cooldown_until).toLocaleString("ko-KR")}</div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground">요청 내역이 없습니다.</div>
            )}
          </CardContent>
        </Card>

        {requestRow && (
          <Card>
            <CardHeader>
              <CardTitle>처리</CardTitle>
              <CardDescription>승인 또는 거절로 상태를 업데이트합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <form action={updateRiderChangeRequest}>
                  <input type="hidden" name="id" value={requestRow.id} />
                  <input type="hidden" name="action" value="approve" />
                <input type="hidden" name="redirect_to" value={`/admin/rider-change-requests/${requestId}`} />
                  <Button className="w-full md:w-auto" disabled={requestRow.status !== "pending"}>
                    승인
                  </Button>
                </form>
              <form action={updateRiderChangeRequest} className="flex w-full flex-col gap-2 md:flex-row md:items-center">
                  <input type="hidden" name="id" value={requestRow.id} />
                  <input type="hidden" name="action" value="deny" />
                <input type="hidden" name="redirect_to" value={`/admin/rider-change-requests/${requestId}`} />
                  <Button variant="outline" disabled={requestRow.status !== "pending"}>
                    거절
                  </Button>
                  <label className="text-sm font-medium md:whitespace-nowrap" htmlFor="admin_reason">
                    거절 사유 (선택)
                  </label>
                  <input
                    id="admin_reason"
                    name="admin_reason"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm md:w-80"
                    placeholder="고객에게 안내할 거절 사유를 입력하세요"
                  />
                </form>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

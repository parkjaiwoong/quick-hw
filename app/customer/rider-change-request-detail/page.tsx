import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getRoleOverride } from "@/lib/role"
import { unstable_noStore as noStore } from "next/cache"

export const dynamic = "force-dynamic"

export default async function RiderChangeRequestDetailByQueryPage({
  searchParams,
}: {
  searchParams?: { id?: string }
}) {
  noStore()
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {}
  const requestId = typeof resolvedSearchParams?.id === "string" ? resolvedSearchParams.id : ""
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    requestId,
  )

  if (!isValidUuid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-balance">기사 변경 요청 상세</h1>
              <p className="text-muted-foreground mt-1">요청 상태와 변경 기사 정보를 확인합니다.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/customer/rider-change-request">목록으로</Link>
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
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) {
    redirect("/")
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let requestRow:
    | {
        id: string
        customer_id: string
        from_rider_id: string
        to_rider_id: string
        status: string
        reason: string | null
        admin_reason: string | null
        cooldown_until: string | null
        created_at: string
      }
    | null = null
  let userScopedError: string | null = null
  let serviceScopedCustomerId: string | null = null

  const { data: userScoped, error: userScopedErr } = await supabase
    .from("rider_change_history")
    .select("id, customer_id, from_rider_id, to_rider_id, status, reason, admin_reason, cooldown_until, created_at")
    .eq("id", requestId)
    .eq("customer_id", user.id)
    .maybeSingle()
  requestRow = userScoped
  userScopedError = userScopedErr?.message ?? null

  if (!requestRow && serviceRoleKey) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)
    const { data } = await supabaseService
      .from("rider_change_history")
      .select("id, customer_id, from_rider_id, to_rider_id, status, reason, admin_reason, cooldown_until, created_at")
      .eq("id", requestId)
      .maybeSingle()
    serviceScopedCustomerId = data?.customer_id ?? null
    if (data && data.customer_id === user.id) {
      requestRow = data
    }
  }

  let fromRiderCode: string | null = null
  let toRiderCode: string | null = null

  if (serviceRoleKey && requestRow) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)
    const riderIds = [requestRow.from_rider_id, requestRow.to_rider_id].filter(Boolean)
    if (riderIds.length) {
      const { data: riderRows } = await supabaseService.from("riders").select("id, code").in("id", riderIds)
      const riderMap = new Map((riderRows || []).map((r: any) => [r.id, r.code]))
      fromRiderCode = riderMap.get(requestRow.from_rider_id) || null
      toRiderCode = riderMap.get(requestRow.to_rider_id) || null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">기사 변경 요청 상세</h1>
            <p className="text-muted-foreground mt-1">요청 상태와 변경 기사 정보를 확인합니다.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/customer/rider-change-request">목록으로</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>요청 정보</CardTitle>
            <CardDescription>요청 상태와 변경 기사 정보를 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {requestRow ? (
              <>
                <div>요청 시간: {new Date(requestRow.created_at).toLocaleString("ko-KR")}</div>
                <div>상태: {requestRow.status === "denied" ? "rejected" : requestRow.status}</div>
                <div>기존 기사 코드: {fromRiderCode || requestRow.from_rider_id || "-"}</div>
                <div>변경 기사 코드: {toRiderCode || requestRow.to_rider_id || "-"}</div>
                <div>변경 사유: {requestRow.reason || "-"}</div>
                <div>거절 사유: {requestRow.admin_reason || "-"}</div>
                {requestRow.cooldown_until && (
                  <div>쿨타임 종료: {new Date(requestRow.cooldown_until).toLocaleString("ko-KR")}</div>
                )}
              </>
            ) : (
              <div className="space-y-2 text-muted-foreground">
                <div>요청 내역이 없습니다.</div>
                <div className="text-xs">요청 ID: {requestId}</div>
                <div className="text-xs">로그인 ID: {user.id}</div>
                {userScopedError && <div className="text-xs">조회 오류: {userScopedError}</div>}
                {serviceRoleKey && (
                  <div className="text-xs">서비스 조회 customer_id: {serviceScopedCustomerId || "-"}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

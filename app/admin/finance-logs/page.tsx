import { getSupabaseServerClient, getServiceRoleClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getRoleOverride } from "@/lib/role"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type LogRow = {
  id: string
  type: string
  occurred_at: string
  amount: number
  driver_name: string
}

type PageProps = {
  searchParams?: {
    status?: string
    driver?: string
    page?: string
  }
}

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "정산 확정", label: "정산 확정" },
  { value: "정산 확정(출금 반영)", label: "정산 확정(출금 반영)" },
  { value: "출금 승인", label: "출금 승인" },
  { value: "출금 반려", label: "출금 반려" },
  { value: "이체 완료", label: "이체 완료" },
  { value: "이체 실패", label: "이체 실패" },
]

export default async function AdminFinanceLogsPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  const adminClient = await getServiceRoleClient()
  const client = adminClient ?? supabase

  const { data: settlements } = await client
    .from("settlements")
    .select("id, driver_id, settlement_amount, settlement_status, updated_at, driver:profiles!settlements_driver_id_fkey(full_name, email)")
    .in("settlement_status", ["CONFIRMED", "PAID_OUT"])
    .order("updated_at", { ascending: false })
    .limit(200)

  const { data: payouts } = await client
    .from("payout_requests")
    .select("id, driver_id, requested_amount, status, processed_at, driver:profiles!payout_requests_driver_id_fkey(full_name, email)")
    .in("status", ["approved", "transferred", "failed", "canceled", "rejected"])
    .order("processed_at", { ascending: false })
    .limit(200)

  const logs: LogRow[] = [
    ...(settlements || []).map((settlement: any) => ({
      id: settlement.id,
      type: settlement.settlement_status === "PAID_OUT" ? "정산 확정(출금 반영)" : "정산 확정",
      occurred_at: settlement.updated_at,
      amount: Number(settlement.settlement_amount || 0),
      driver_name: (settlement.driver?.full_name || settlement.driver?.email) || (settlement.driver_id ? `기사(${String(settlement.driver_id).slice(0, 8)})` : "알 수 없음"),
    })),
    ...(payouts || []).map((payout: any) => ({
      id: payout.id,
      type:
        payout.status === "transferred"
          ? "이체 완료"
          : payout.status === "failed"
            ? "이체 실패"
            : payout.status === "canceled" || payout.status === "rejected"
              ? "출금 반려"
              : "출금 승인",
      occurred_at: payout.processed_at || "",
      amount: Number(payout.requested_amount || 0),
      driver_name: (payout.driver?.full_name || payout.driver?.email) || (payout.driver_id ? `기사(${String(payout.driver_id).slice(0, 8)})` : "알 수 없음"),
    })),
  ]
    .filter((log) => log.occurred_at)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  const rawStatus = (searchParams?.status ?? "all").trim() || "all"
  const statusFilter = rawStatus === "all" ? null : rawStatus
  const driverFilter = (searchParams?.driver ?? "").trim()
  const page = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1)

  const filtered = logs.filter((log) => {
    if (statusFilter && log.type !== statusFilter) {
      return false
    }
    if (driverFilter && !log.driver_name.toLowerCase().includes(driverFilter.toLowerCase())) {
      return false
    }
    return true
  })

  const totalCount = filtered.length
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE
  const pageLogs = filtered.slice(from, to)

  const makePageHref = (nextPage: number) => {
    const params = new URLSearchParams()
    if (statusFilter) params.set("status", statusFilter)
    if (driverFilter) params.set("driver", driverFilter)
    params.set("page", String(nextPage))
    const qs = params.toString()
    return qs ? `/admin/finance-logs?${qs}` : "/admin/finance-logs"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">금액 액션 로그</h1>
          <p className="text-muted-foreground mt-1">정산 확정/출금 처리/반려 기록을 확인합니다</p>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">로그 보관 정책</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            로그는 수정/삭제가 불가능하며, 시간순으로 조회됩니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>액션 로그</CardTitle>
            <CardDescription>상태 · 기사명 조건으로 조회하고, 그리드/페이징으로 확인합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <form className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30" method="GET">
              <div className="space-y-1.5">
                <Label htmlFor="status">상태</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={statusFilter ?? "all"}
                  className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="driver">기사명</Label>
                <Input
                  id="driver"
                  name="driver"
                  defaultValue={driverFilter}
                  placeholder="기사명 또는 이메일 검색"
                  className="h-9 w-[220px]"
                />
              </div>
              <input type="hidden" name="page" value="1" />
              <Button type="submit" size="sm">
                조회
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  // GET 폼이라 JS 없이도 동작해야 하므로, 서버에서 제공하는 기본 링크 사용
                  if (typeof window !== "undefined") {
                    window.location.href = "/admin/finance-logs"
                  }
                }}
              >
                초기화
              </Button>
            </form>

            {totalCount === 0 ? (
              <p className="text-muted-foreground text-center py-8">조건에 맞는 로그가 없습니다</p>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">발생 시각</TableHead>
                        <TableHead className="min-w-[140px]">상태</TableHead>
                        <TableHead className="min-w-[180px]">대상 기사</TableHead>
                        <TableHead className="text-right min-w-[120px]">금액</TableHead>
                        <TableHead className="min-w-[140px]">관리자</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageLogs.map((log) => (
                        <TableRow key={`${log.type}-${log.id}`}>
                          <TableCell className="text-muted-foreground">
                            {new Date(log.occurred_at).toLocaleString("ko-KR")}
                          </TableCell>
                          <TableCell>{log.type}</TableCell>
                          <TableCell>{log.driver_name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {log.amount.toLocaleString()}원
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {profile?.full_name || "관리자"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    전체 {totalCount}건 중 {(from + 1).toLocaleString()}–
                    {Math.min(to, totalCount).toLocaleString()}건
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    {page > 1 && (
                      <Link href={makePageHref(page - 1)} className="text-primary hover:underline">
                        이전
                      </Link>
                    )}
                    {page * PAGE_SIZE < totalCount && (
                      <Link href={makePageHref(page + 1)} className="text-primary hover:underline">
                        다음
                      </Link>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

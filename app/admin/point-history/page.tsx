import { getSupabaseServerClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"

export const dynamic = "force-dynamic"

const pointTypeConfig: Record<string, { label: string; color: string; sign: string }> = {
  earned:  { label: "적립", color: "bg-green-100 text-green-800",  sign: "+" },
  used:    { label: "사용", color: "bg-red-100 text-red-800",     sign: "-" },
  expired: { label: "만료", color: "bg-gray-100 text-gray-600",   sign: "-" },
}

export default async function PointHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; type?: string }>
}) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) redirect("/")

  // service role 클라이언트로 RLS 우회 (관리자 전체 조회)
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : supabase

  const sp = searchParams ? await searchParams : {}
  const query    = sp?.q?.trim() ?? ""
  const typeFilter = sp?.type ?? "all"

  // 1. 검색어로 profiles 먼저 조회
  let filteredUserIds: string[] | null = null
  if (query) {
    const { data: matched } = await svc
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    filteredUserIds = (matched ?? []).map((p: any) => p.id)
  }

  // 2. points 테이블 조회 (실제 사용 테이블)
  let pointQuery = svc
    .from("points")
    .select("id, user_id, points, point_type, source_type, source_id, description, created_at")
    .order("created_at", { ascending: false })
    .limit(300)

  if (filteredUserIds !== null) {
    if (filteredUserIds.length === 0) {
      pointQuery = pointQuery.eq("user_id", "00000000-0000-0000-0000-000000000000") // 결과 없음
    } else {
      pointQuery = pointQuery.in("user_id", filteredUserIds)
    }
  }

  if (typeFilter !== "all") {
    pointQuery = pointQuery.eq("point_type", typeFilter)
  }

  const { data: pointRows, error } = await pointQuery
  const points: any[] = pointRows ?? []

  // 3. 관련 profiles 조회
  const userIds = Array.from(new Set(points.map((p: any) => p.user_id)))
  let profileMap = new Map<string, { full_name: string | null; email: string | null }>()
  if (userIds.length) {
    const { data: profiles } = await svc
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds)
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { full_name: p.full_name, email: p.email })
    }
  }

  // 4. 집계
  const totalEarned = points.filter((p) => p.point_type === "earned").reduce((s, p) => s + Number(p.points), 0)
  const totalUsed   = points.filter((p) => p.point_type === "used" || p.point_type === "expired").reduce((s, p) => s + Number(p.points), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">고객 포인트 내역</h1>
            <p className="text-muted-foreground mt-1">전체 고객 포인트 적립/사용 이력</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/point-redemptions">교환 요청 관리</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin">관리자 홈으로</Link>
            </Button>
          </div>
        </div>

        {/* 집계 요약 */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>조회된 총 적립</CardDescription>
              <CardTitle className="text-2xl text-green-600">+{totalEarned.toLocaleString()}P</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>조회된 총 사용/만료</CardDescription>
              <CardTitle className="text-2xl text-red-600">-{totalUsed.toLocaleString()}P</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>조회 건수</CardDescription>
              <CardTitle className="text-2xl">{points.length}건</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>포인트 이력</CardTitle>
            <CardDescription>`points` 테이블 기준 — 고객 화면과 동일한 데이터입니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 검색 폼 */}
            <form action="/admin/point-history" className="flex flex-col gap-2 md:flex-row md:items-end flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="text-sm font-medium block mb-1" htmlFor="customer_search">고객 검색</label>
                <input
                  id="customer_search"
                  name="q"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="이름 · 이메일 · 전화번호"
                  defaultValue={query}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" htmlFor="type_filter">구분</label>
                <select
                  id="type_filter"
                  name="type"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={typeFilter}
                >
                  <option value="all">전체</option>
                  <option value="earned">적립</option>
                  <option value="used">사용</option>
                  <option value="expired">만료</option>
                </select>
              </div>
              <Button type="submit" variant="outline" className="self-end">검색</Button>
              {(query || typeFilter !== "all") && (
                <Button asChild variant="ghost" className="self-end">
                  <Link href="/admin/point-history">초기화</Link>
                </Button>
              )}
            </form>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                데이터를 불러오지 못했습니다: {(error as any).message}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>고객</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead className="text-right">포인트</TableHead>
                    <TableHead>출처</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead>일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {points.length > 0 ? (
                    points.map((item: any) => {
                      const p = profileMap.get(item.user_id)
                      const displayName = p?.full_name || p?.email || item.user_id.slice(0, 8)
                      const cfg = pointTypeConfig[item.point_type] ?? { label: item.point_type, color: "bg-gray-100 text-gray-700", sign: "" }
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{displayName}</TableCell>
                          <TableCell>
                            <Badge className={cfg.color}>{cfg.label}</Badge>
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${item.point_type === "earned" ? "text-green-600" : "text-red-600"}`}>
                            {cfg.sign}{Number(item.points).toLocaleString()}P
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.source_type || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{item.description || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(item.created_at).toLocaleString("ko-KR")}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
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

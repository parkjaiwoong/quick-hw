import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getRoleOverride } from "@/lib/role"
import { getRiderOverrides, updateRiderOverride } from "@/lib/actions/rider-reward-policy"

export default async function RiderRewardPolicyPage({
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

  const { data: riders } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "driver")
    .order("created_at", { ascending: false })

  const { overrides } = await getRiderOverrides()

  const riderMap = new Map(
    (riders || []).map((r: any) => [r.id, r.full_name || r.email || r.id]),
  )
  const query = (searchParams?.q || "").trim().toLowerCase()
  const displayedOverrides = query.length
    ? (overrides || []).filter((override: any) => {
        const label = String(riderMap.get(override.rider_id) || override.rider_id).toLowerCase()
        return label.includes(query) || String(override.rider_id).toLowerCase().includes(query)
      })
    : overrides

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">기사별 리워드 %</h1>
            <p className="text-muted-foreground mt-1">기사별 override 정책 관리</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>기사별 리워드 % 관리</CardTitle>
            <CardDescription>기사별 override 정책을 설정합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action="/admin/rider-reward-policy" className="flex flex-col gap-2 md:flex-row md:items-end">
              <div className="flex-1">
                <Label htmlFor="rider_search">기사 검색</Label>
                <Input
                  id="rider_search"
                  name="q"
                  placeholder="이름 또는 이메일"
                  defaultValue={query}
                />
              </div>
              <Button type="submit" variant="outline">
                검색
              </Button>
            </form>
            <form action={updateRiderOverride} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rider_id">기사 선택</Label>
                  <select
                    id="rider_id"
                    name="rider_id"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    <option value="">기사 선택</option>
                    {(riders || []).map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name || r.email || r.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rider_reward_rate">override %</Label>
                  <Input
                    id="rider_reward_rate"
                    name="rider_reward_rate"
                    type="number"
                    step="0.1"
                    min={0}
                    placeholder="예: 7"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="active_from">적용 시작일</Label>
                  <Input id="active_from" name="active_from" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="active_to">적용 종료일</Label>
                  <Input id="active_to" name="active_to" type="date" />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                입력 값은 퍼센트(%) 기준이며 저장 시 소수점 비율로 변환됩니다.
              </div>
              <Button type="submit">기사별 정책 저장</Button>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>기사</TableHead>
                  <TableHead>override %</TableHead>
                  <TableHead>적용 시작</TableHead>
                  <TableHead>적용 종료</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedOverrides && displayedOverrides.length > 0 ? (
                  displayedOverrides.map((override: any) => (
                    <TableRow key={override.id}>
                      <TableCell>{riderMap.get(override.rider_id) || override.rider_id}</TableCell>
                      <TableCell>{Number(override.rider_reward_rate || 0) * 100}%</TableCell>
                      <TableCell>
                        {override.active_from ? new Date(override.active_from).toLocaleDateString("ko-KR") : "-"}
                      </TableCell>
                      <TableCell>
                        {override.active_to ? new Date(override.active_to).toLocaleDateString("ko-KR") : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      등록된 override 정책이 없습니다.
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

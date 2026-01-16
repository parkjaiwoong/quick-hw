import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import { updateRiderRewardStatus } from "@/lib/actions/rider-reward-history"

export default async function RiderRewardsPage({
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
  let rewards: any[] = []
  let error: { message: string } | null = null

  if (query) {
    const { data: matchedRiders, error: riderError } = await supabase
      .from("rider")
      .select("id")
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)

    if (riderError) {
      error = riderError
    } else {
      const riderIds = (matchedRiders || []).map((r: any) => r.id)
      if (riderIds.length) {
        const { data: rewardRows, error: rewardError } = await supabase
          .from("rider_reward_history")
          .select("id, order_id, rider_id, reward_rate, reward_amount, status, created_at")
          .in("rider_id", riderIds)
          .order("created_at", { ascending: false })
          .limit(200)

        if (rewardError) {
          error = rewardError
        } else {
          rewards = rewardRows || []
        }
      }
    }
  } else {
    const { data: rewardRows, error: rewardError } = await supabase
      .from("rider_reward_history")
      .select("id, order_id, rider_id, reward_rate, reward_amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200)

    if (rewardError) {
      error = rewardError
    } else {
      rewards = rewardRows || []
    }
  }

  const riderIds = Array.from(new Set((rewards || []).map((r: any) => r.rider_id)))
  const orderIds = Array.from(new Set((rewards || []).map((r: any) => r.order_id)))

  const { data: riders } = riderIds.length
    ? await supabase.from("rider").select("id, name, email").in("id", riderIds)
    : { data: [] }
  const { data: orders } = orderIds.length
    ? await supabase.from("orders").select("id, order_amount").in("id", orderIds)
    : { data: [] }

  const riderMap = new Map((riders || []).map((r: any) => [r.id, r.name || r.email || r.id]))
  const orderMap = new Map((orders || []).map((o: any) => [o.id, o.order_amount]))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">기사 리워드 정산</h1>
            <p className="text-muted-foreground mt-1">주문별 리워드 정산 내역</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>기사 리워드 이력</CardTitle>
            <CardDescription>주문별 리워드 정산 내역을 확인합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action="/admin/rider-rewards" className="flex flex-col gap-2 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium" htmlFor="rider_search">
                  기사 검색
                </label>
                <input
                  id="rider_search"
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
                    <TableHead>주문 ID</TableHead>
                    <TableHead>기사</TableHead>
                    <TableHead>주문 금액</TableHead>
                    <TableHead>리워드 %</TableHead>
                    <TableHead>리워드 금액</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>변경</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards && rewards.length > 0 ? (
                    rewards.map((reward: any) => (
                      <TableRow key={reward.id}>
                        <TableCell className="text-xs">{reward.order_id}</TableCell>
                        <TableCell>{riderMap.get(reward.rider_id) || reward.rider_id}</TableCell>
                        <TableCell>
                          {orderMap.get(reward.order_id)?.toLocaleString?.() ?? "-"}원
                        </TableCell>
                        <TableCell>{Number(reward.reward_rate || 0) * 100}%</TableCell>
                        <TableCell>{Number(reward.reward_amount || 0).toLocaleString()}원</TableCell>
                        <TableCell>{reward.status}</TableCell>
                        <TableCell>
                          <form action={updateRiderRewardStatus} className="flex items-center gap-2">
                            <input type="hidden" name="id" value={reward.id} />
                            <select
                              name="status"
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                              defaultValue={reward.status}
                            >
                              <option value="pending">pending</option>
                              <option value="confirmed">confirmed</option>
                              <option value="paid">paid</option>
                            </select>
                            <Button size="sm" type="submit">
                              변경
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        리워드 이력이 없습니다.
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

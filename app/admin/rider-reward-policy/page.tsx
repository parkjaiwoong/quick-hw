import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import { getRewardPolicy } from "@/lib/actions/reward-policy"

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

  const { policy } = await getRewardPolicy()
  const riderRate = Number(policy?.rider_reward_rate ?? 0) * 100
  const companyRate = Number(policy?.company_share_rate ?? 0) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">리워드 적용 방식</h1>
            <p className="text-muted-foreground mt-1">소개 관계 기반으로 리워드가 적용됩니다</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>현재 적용 중인 리워드 정책</CardTitle>
            <CardDescription>모든 기사에게 동일한 정책이 적용됩니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">기사 리워드 %</p>
                <p className="text-2xl font-semibold">{riderRate}%</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">회사 분배 %</p>
                <p className="text-2xl font-semibold">{companyRate}%</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
              <p>1. 고객이 기사에게 소개되어 `customer_referral`에 연결된 경우만 리워드가 발생합니다.</p>
              <p>2. 소개된 기사의 리워드 %는 위 정책을 기준으로 동일하게 적용됩니다.</p>
              <p>3. 소개 관계가 없는 주문은 기사 리워드가 발생하지 않습니다.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link href="/admin/reward-policy">리워드 정책 수정</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/referrals">고객 소개 현황 보기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

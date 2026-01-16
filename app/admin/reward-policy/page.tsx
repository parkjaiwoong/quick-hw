import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getRoleOverride } from "@/lib/role"
import { getRewardPolicy, updateRewardPolicy } from "@/lib/actions/reward-policy"

export default async function RewardPolicyPage() {
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
  const riderRate = Number(policy?.rider_reward_rate ?? 0.07) * 100
  const companyRate = Number(policy?.company_share_rate ?? 0.03) * 100
  const customerRate = Number(policy?.customer_reward_rate ?? 0.05) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">기본 리워드 정책</h1>
            <p className="text-muted-foreground mt-1">기사/고객 기본 리워드 비율 관리</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>기본 리워드 정책 관리</CardTitle>
            <CardDescription>기사/고객 기본 리워드 비율을 설정합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={updateRewardPolicy} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rider_reward_rate">기사 리워드 (%)</Label>
                  <Input
                    id="rider_reward_rate"
                    name="rider_reward_rate"
                    type="number"
                    step="0.1"
                    min={0}
                    defaultValue={riderRate}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_share_rate">회사 분배 (%)</Label>
                  <Input
                    id="company_share_rate"
                    name="company_share_rate"
                    type="number"
                    step="0.1"
                    min={0}
                    defaultValue={companyRate}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_reward_rate">고객 리워드 (%)</Label>
                  <Input
                    id="customer_reward_rate"
                    name="customer_reward_rate"
                    type="number"
                    step="0.1"
                    min={0}
                    defaultValue={customerRate}
                  />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                입력 값은 퍼센트(%) 기준이며 저장 시 소수점 비율로 변환됩니다.
              </div>
              <Button type="submit">정책 저장</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

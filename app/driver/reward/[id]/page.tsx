import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getDeliveryForDriver } from "@/lib/actions/tracking"
import { getRoleOverride } from "@/lib/role"

export default async function DriverRewardDetailPage({ params }: { params: { id: string } }) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"

  if (!canActAsDriver) {
    redirect("/")
  }

  const { id } = await params
  const { delivery } = await getDeliveryForDriver(id)

  if (!delivery) {
    redirect("/driver")
  }

  const isPending = delivery.status === "pending" && !delivery.driver_id
  const isAssignedToMe = delivery.driver_id === user.id
  if (!isPending && !isAssignedToMe) {
    redirect("/driver")
  }

  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseService = serviceRoleKey
    ? createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)
    : null

  const { data: customerProfile } = supabaseService && delivery.customer_id
    ? await supabaseService
        .from("profiles")
        .select("id, referring_driver_id")
        .eq("id", delivery.customer_id)
        .maybeSingle()
    : { data: null }

  const { data: rewardPolicy } = supabaseService
    ? await supabaseService
        .from("reward_policy_master")
        .select("rider_reward_rate")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const rewardRate = Number(rewardPolicy?.rider_reward_rate || 0)
  const baseDriverFee = Number(delivery.driver_fee ?? delivery.total_fee ?? 0)
  const totalFee = Number(delivery.total_fee ?? baseDriverFee)
  const isReferralCustomer = Boolean(customerProfile && customerProfile.referring_driver_id === user.id)
  const referralBonus = isReferralCustomer ? Math.round(totalFee * rewardRate) : 0
  const referralTotal = baseDriverFee + referralBonus

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">리워드 적용 상세</h1>
            <p className="text-sm text-muted-foreground">추천 고객 여부에 따라 리워드가 적용됩니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/driver/delivery/${delivery.id}`}>배송 상세로</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/driver">기사 대시보드</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>기본 요금</CardTitle>
            <CardDescription>카카오픽 방식 기본 요금</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-blue-700">
            {baseDriverFee.toLocaleString()}원
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>추천 리워드 적용</CardTitle>
            <CardDescription>추천 고객 배송일 때만 적용</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">추천 고객 여부</span>
              <span className="font-semibold">{isReferralCustomer ? "적용" : "미적용"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">리워드 비율</span>
              <span className="font-semibold">{Math.round(rewardRate * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">추가 리워드</span>
              <span className="font-semibold text-emerald-700">+{referralBonus.toLocaleString()}원</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>추천 기준</CardTitle>
            <CardDescription>추천 고객 판단 근거를 확인합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">고객 ID</span>
              <span className="font-medium">{delivery.customer_id || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">추천 기사 ID</span>
              <span className="font-medium">{customerProfile?.referring_driver_id || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">현재 기사 ID</span>
              <span className="font-medium">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">적용 기준</span>
              <span className="font-medium">
                {isReferralCustomer ? "고객의 추천 기사 ID가 본인과 일치" : "추천 기사 ID 불일치 또는 없음"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-200">
          <CardHeader>
            <CardTitle>예상 수익 합계</CardTitle>
            <CardDescription>기본 요금 + 리워드</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-emerald-700">
            {referralTotal.toLocaleString()}원
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">정산 기준 안내</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>기본 요금은 카카오픽 방식으로 산정된 운임 기준입니다.</p>
            <p>추천 리워드는 추천 고객 배송에만 적용되며, 정책 비율은 관리자 설정을 따릅니다.</p>
            <p>최종 정산 금액은 실제 정산 내역 기준으로 확정됩니다.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

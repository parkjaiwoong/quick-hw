import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ReferralForm } from "@/components/customer/referral-form"
import { Users, Gift } from "lucide-react"
import { getRoleOverride } from "@/lib/role"

export default async function ReferralPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const roleOverride = await getRoleOverride()
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) {
    redirect("/")
  }

  // 추천인 관계 확인
  const { data: referral } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_id", user.id)
    .single()

  // 내 추천 코드 생성 (간단하게 user id 기반)
  const myReferralCode = user.id.slice(0, 8).toUpperCase()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">추천인 프로그램</h1>
            <p className="text-muted-foreground mt-1">친구를 추천하고 포인트를 받으세요</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>내 추천 코드</CardTitle>
              <CardDescription>친구에게 공유하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-2xl font-bold font-mono">{myReferralCode}</p>
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(myReferralCode)
                }}
                className="w-full"
              >
                코드 복사하기
              </Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• 친구가 추천 코드로 가입하면</p>
                <p>• 친구가 첫 배송을 완료하면</p>
                <p>• 추천인: 500포인트, 추천받은 친구: 300포인트 적립</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>추천인 등록</CardTitle>
              <CardDescription>추천인 코드를 입력하세요</CardDescription>
            </CardHeader>
            <CardContent>
              {referral ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-800">추천인이 등록되어 있습니다</p>
                    <p className="text-xs text-green-600 mt-1">
                      상태: {referral.status === "completed" ? "완료" : "대기 중"}
                    </p>
                    {referral.completed_at && (
                      <p className="text-xs text-green-600">
                        완료일: {new Date(referral.completed_at).toLocaleDateString("ko-KR")}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <ReferralForm />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>추천인 프로그램 안내</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Gift className="h-4 w-4" />
                보상 안내
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>추천인: 친구가 첫 배송 완료 시 500포인트 적립</li>
                <li>추천받은 친구: 첫 배송 완료 시 300포인트 적립</li>
                <li>포인트는 배송 완료 후 즉시 적립됩니다</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                이용 방법
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>내 추천 코드를 친구에게 공유하세요</li>
                <li>친구가 가입 시 추천인 코드를 입력하세요</li>
                <li>친구가 첫 배송을 완료하면 포인트가 자동으로 적립됩니다</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getRoleOverride } from "@/lib/role"
import { ensureDriverWallet, getDriverWalletSummary, requestPayout } from "@/lib/actions/finance"

export default async function DriverWalletPage() {
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

  await ensureDriverWallet(user.id)
  const { wallet, payouts, pendingPayoutAmount } = await getDriverWalletSummary(user.id)

  async function handleRequestPayout(formData: FormData) {
    "use server"
    const rawAmount = Number(formData.get("amount") || 0)
    await requestPayout(user.id, rawAmount)
    redirect("/driver/wallet")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">적립금 지갑</h1>
          <p className="text-muted-foreground mt-1">정산 및 출금 상태를 확인하세요</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>현재 적립금</CardDescription>
              <CardTitle className="text-2xl">{Number(wallet?.total_balance || 0).toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">배송 완료 후 적립됩니다</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>출금 가능</CardDescription>
              <CardTitle className="text-2xl text-green-700">
                {Number(wallet?.available_balance || 0).toLocaleString()}원
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              최소 기준: {Number(wallet?.min_payout_amount || 0).toLocaleString()}원
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>출금 대기</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{pendingPayoutAmount.toLocaleString()}원</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">요청 처리 중 금액</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>출금 요청</CardTitle>
            <CardDescription>출금 가능 금액 내에서 요청 가능합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleRequestPayout} className="flex flex-col md:flex-row gap-3">
              <Input name="amount" type="number" min={0} step="1" placeholder="출금 금액 (원)" />
              <Button type="submit">출금 요청</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>출금 요청 내역</CardTitle>
            <CardDescription>최근 요청 상태를 확인하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">출금 요청 내역이 없습니다</p>
            ) : (
              payouts.map((payout) => (
                <div key={payout.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{Number(payout.requested_amount).toLocaleString()}원</p>
                    <p className="text-xs text-muted-foreground">
                      요청일: {new Date(payout.requested_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <span className="text-xs rounded px-2 py-1 bg-muted">{payout.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

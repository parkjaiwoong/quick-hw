import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getRoleOverride } from "@/lib/role"
import { getAdminPayoutRequests, markPayoutPaid } from "@/lib/actions/finance"

export default async function AdminPayoutsPage() {
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

  const { payouts = [] } = await getAdminPayoutRequests()

  async function handleMarkPaid(formData: FormData) {
    "use server"
    const payoutId = String(formData.get("id") || "")
    if (!payoutId) return
    await markPayoutPaid(payoutId)
    redirect("/admin/payouts")
  }

  const pendingTotal = payouts
    .filter((p: any) => p.status === "pending")
    .reduce((sum: number, p: any) => sum + Number(p.requested_amount || 0), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">출금 관리</h1>
            <p className="text-muted-foreground mt-1">출금 요청을 확인하고 엑셀을 생성하세요</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/api/admin/payouts/export">엑셀 다운로드</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>출금 요청 합계 (대기)</CardDescription>
            <CardTitle className="text-2xl">{pendingTotal.toLocaleString()}원</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>출금 요청 리스트</CardTitle>
            <CardDescription>은행 업로드용 데이터를 확인합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">출금 요청이 없습니다</p>
            ) : (
              payouts.map((payout: any) => (
                <div key={payout.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{payout.driver?.full_name || payout.driver?.email || "기사"}</p>
                    <p className="text-sm text-muted-foreground">
                      요청 금액: {Number(payout.requested_amount).toLocaleString()}원
                    </p>
                    <p className="text-xs text-muted-foreground">
                      계좌: {payout.bank_name || "-"} {payout.bank_account || "-"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs rounded px-2 py-1 bg-muted">{payout.status}</span>
                    {payout.status !== "paid" && (
                      <form action={handleMarkPaid}>
                        <input type="hidden" name="id" value={payout.id} />
                        <Button type="submit" size="sm">
                          출금 완료 처리
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

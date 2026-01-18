import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllPayments } from "@/lib/actions/finance"
import { getRoleOverride } from "@/lib/role"

export default async function AdminPaymentsPage() {
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

  const { payments = [] } = await getAllPayments()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">결제 관리</h1>
          <p className="text-muted-foreground mt-1">주문별 결제 상태를 확인하세요</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>결제 내역</CardTitle>
            <CardDescription>결제 수단 및 상태를 확인합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">결제 내역이 없습니다</p>
            ) : (
              payments.map((payment: any) => (
                <div key={payment.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{payment.customer?.full_name || payment.customer?.email || "고객"}</p>
                    <p className="text-sm text-muted-foreground">
                      결제 수단: {payment.payment_method} | 금액: {Number(payment.amount).toLocaleString()}원
                    </p>
                    <p className="text-xs text-muted-foreground">
                      결제일: {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("ko-KR") : "-"}
                    </p>
                  </div>
                  <span className="text-xs rounded px-2 py-1 bg-muted">{payment.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

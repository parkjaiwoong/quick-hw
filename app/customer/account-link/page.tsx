import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CreditCard, ArrowLeft } from "lucide-react"
import { getCustomerBillingKey, deleteCustomerBillingKey } from "@/lib/actions/billing"
import { BillingAuthButton } from "@/components/customer/billing-auth-button"
import { BillingKeyDeleteForm } from "./billing-key-delete-form"

export default async function CustomerAccountLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const params = await searchParams
  const billingStatus = typeof params?.billing === "string" ? params.billing : null
  const billingMessage = typeof params?.message === "string" ? decodeURIComponent(params.message) : null

  const { billingKey } = await getCustomerBillingKey(user.id)
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || ""
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const successUrl = `${baseUrl}/customer/account-link/billing-success`
  const failUrl = `${baseUrl}/customer/account-link?billing=fail`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href="/customer/new-delivery" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            새 배송 요청으로
          </Link>
        </Button>

        {billingStatus === "success" && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            카드가 등록되었습니다. 결제 시 &quot;등록된 카드로 결제&quot;를 선택할 수 있습니다.
          </div>
        )}
        {billingStatus === "fail" && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {billingMessage || "카드 등록에 실패했습니다."}
          </div>
        )}
        {billingStatus === "invalid" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            유효하지 않은 요청입니다.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              계좌/카드 연동
            </CardTitle>
            <CardDescription>
              카드를 등록하면 결제 시 카드 입력 없이 &quot;등록된 카드로 결제&quot;를 사용할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {billingKey ? (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="font-medium text-sm">등록된 카드</p>
                <p className="text-sm text-muted-foreground">
                  {billingKey.card_company || "카드"} {billingKey.card_number_masked || "****"}
                </p>
                <BillingKeyDeleteForm userId={user.id} />
              </div>
            ) : null}

            {clientKey ? (
              <BillingAuthButton
                customerKey={user.id}
                successUrl={successUrl}
                failUrl={failUrl}
                clientKey={clientKey}
              />
            ) : (
              <p className="text-xs text-muted-foreground">결제 키가 설정되지 않아 카드 등록을 사용할 수 없습니다.</p>
            )}

            <Button asChild variant="secondary" className="w-full">
              <Link href="/customer/new-delivery">새 배송 요청하기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

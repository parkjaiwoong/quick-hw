import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CreditCard, CheckCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function BillingSuccessPage({
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
  const authKey = typeof params?.authKey === "string" ? params.authKey : null
  const customerKey = typeof params?.customerKey === "string" ? params.customerKey : null

  if (!authKey || !customerKey || customerKey !== user.id) {
    redirect("/customer/account-link?billing=invalid")
  }

  const { issueBillingKeyFromAuth } = await import("@/lib/actions/billing")
  const result = await issueBillingKeyFromAuth(authKey, customerKey)

  if (result.error) {
    redirect(`/customer/account-link?billing=fail&message=${encodeURIComponent(result.error)}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              카드 등록 완료
            </CardTitle>
            <CardDescription>
              등록된 카드는 결제 시 &quot;등록된 카드로 결제&quot;에서 사용할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/customer/account-link" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                계좌 연동 화면으로
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

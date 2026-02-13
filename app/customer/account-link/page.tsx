import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CreditCard, ArrowLeft } from "lucide-react"

export default async function CustomerAccountLinkPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href="/customer/new-delivery" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            새 배송 요청으로
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              계좌/카드 연동
            </CardTitle>
            <CardDescription>
              기사 연결 요청 시 결제를 빠르게 하려면 결제 수단을 미리 연동해 두세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              현재는 배송 요청 시 선택한 결제 수단(카드/계좌이체/현금)으로 결제 페이지에서 진행합니다.
              자동 결제(빌링키) 연동을 원하시면 아래 준비 사항을 확인한 뒤 개발팀에 문의하세요.
            </p>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
              <p className="font-medium">연동 시 필요한 준비 (운영 측)</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>토스페이먼츠 빌링키(자동결제) API 활성화</li>
                <li>고객별 빌링키 발급·저장 및 결제 요청 연동</li>
                <li>계좌이체 시 출금 동의·예치금 등 정책 확인</li>
              </ul>
            </div>
            <Button asChild className="w-full">
              <Link href="/customer/new-delivery">새 배송 요청하기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

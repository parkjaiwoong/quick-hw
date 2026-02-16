import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Calculator, ArrowLeft, Info } from "lucide-react"
import { getRoleOverride } from "@/lib/role"

export default async function NewSettlementInfoPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) redirect("/")

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/settlements" className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            정산 관리로 돌아가기
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              정산 생성 안내
            </CardTitle>
            <CardDescription>정산은 결제 완료 시 자동으로 생성·확정됩니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 flex gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-2">
                <p className="font-medium">자동 정산 플로우</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>고객이 결제를 완료하면 해당 주문에 연결된 배송원의 정산이 자동 생성됩니다.</li>
                  <li>정산 상태는 결제 완료 시 자동으로 확정(출금 가능) 처리됩니다.</li>
                  <li>배송원이 출금을 요청하면 출금 관리에서 승인·이체 완료 처리할 수 있습니다.</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              정산 목록은 <strong>정산 관리</strong>에서 확인하고, 엑셀 다운로드·잠금 해제 등이 가능합니다.
            </p>
            <Button asChild className="w-full">
              <Link href="/admin/settlements">정산 목록 보기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getRoleOverride } from "@/lib/role"
import { getCompanyInfo } from "@/lib/actions/company"
import { CompanyForm } from "@/components/admin/company-form"
import { Building2 } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CompanyPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) redirect("/")

  const companyInfo = await getCompanyInfo()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              회사 정보 관리
            </h1>
            <p className="text-sm text-muted-foreground">
              로고·도장 이미지 및 회사 기본 정보를 관리합니다
            </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>회사 정보</CardTitle>
            <CardDescription>
              저장된 정보는 헤더 로고, 영수증 회사명·도장에 즉시 반영됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm initialData={companyInfo} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

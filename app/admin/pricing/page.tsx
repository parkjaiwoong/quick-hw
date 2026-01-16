import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import { getPricingConfig, updatePricingConfig } from "@/lib/actions/admin"
import { PricingForm } from "@/components/admin/pricing-form"

export default async function PricingPage() {
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

  const { pricing, error: pricingError } = await getPricingConfig()

  const baseFee = Number(pricing?.base_fee ?? 4000)
  const perKmFee = Number(pricing?.per_km_fee ?? 1000)
  const platformCommissionRate = Number(pricing?.platform_commission_rate ?? 0)
  const minDriverFee = Number(pricing?.min_driver_fee ?? 0)
  const includedDistanceKm = 2

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">가격 정책</h1>
            <p className="text-muted-foreground mt-1">카카오픽 기준 자동 산정 값</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>가격 정책</CardTitle>
            <CardDescription>카카오픽 기준 자동 산정 값을 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {pricingError && (
              <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                {pricingError.includes("pricing_config") || pricingError.includes("schema cache")
                  ? "가격 정책 테이블이 없습니다. scripts/003_seed_data.sql 을 실행해주세요."
                  : `가격 정책을 불러오지 못했습니다: ${pricingError}`}
              </div>
            )}
            <PricingForm
              baseFee={baseFee}
              perKmFee={perKmFee}
              platformCommissionRate={platformCommissionRate}
              minDriverFee={minDriverFee}
              includedDistanceKm={includedDistanceKm}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

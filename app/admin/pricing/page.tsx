import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import { getPricingConfig, updatePricingConfig } from "@/lib/actions/admin"

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

  const { pricing } = await getPricingConfig()

  const baseFee = Number(pricing?.base_fee ?? 4000)
  const perKmFee = Number(pricing?.per_km_fee ?? 1000)
  const platformCommissionRate = Number(pricing?.platform_commission_rate ?? 0)
  const minDriverFee = Number(pricing?.min_driver_fee ?? 0)
  const includedDistanceKm = 2

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>가격 정책</CardTitle>
            <CardDescription>카카오픽 기준 자동 산정 값을 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updatePricingConfig} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="base_fee">기본 요금 (원)</Label>
                  <Input id="base_fee" name="base_fee" type="number" defaultValue={baseFee} min={0} step="1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="per_km_fee">km당 요금 (원)</Label>
                  <Input id="per_km_fee" name="per_km_fee" type="number" defaultValue={perKmFee} min={0} step="1" />
                </div>
                <div className="space-y-2">
                  <Label>기본 거리 포함 (km)</Label>
                  <Input value={includedDistanceKm} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platform_commission_rate">플랫폼 수수료율 (%)</Label>
                  <Input
                    id="platform_commission_rate"
                    name="platform_commission_rate"
                    type="number"
                    defaultValue={platformCommissionRate}
                    min={0}
                    step="0.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_driver_fee">최소 배송원 수익 (원)</Label>
                  <Input
                    id="min_driver_fee"
                    name="min_driver_fee"
                    type="number"
                    defaultValue={minDriverFee}
                    min={0}
                    step="1"
                  />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
                현재 계산식: 기본요금 + max(0, 거리 - {includedDistanceKm}km) × km당 요금
              </div>
              <Button type="submit" className="w-full">
                가격 정책 저장
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

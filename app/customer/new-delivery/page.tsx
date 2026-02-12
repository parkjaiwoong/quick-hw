import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeliveryRequestForm } from "@/components/customer/delivery-request-form"

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await getSupabaseServerClient()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  const { data: pricing } = await supabase
    .from("pricing_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const get = (key: string) => {
    const v = params[key]
    return Array.isArray(v) ? v[0] : (v as string | undefined)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>새 배송 요청</CardTitle>
            <CardDescription>픽업 및 배송 정보를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <DeliveryRequestForm
              userProfile={profile}
              pricingConfig={pricing}
              initialPickupAddress={get("pickupAddress")}
              initialPickupLat={get("pickupLat")}
              initialPickupLng={get("pickupLng")}
              initialDeliveryAddress={get("deliveryAddress")}
              initialDeliveryLat={get("deliveryLat")}
              initialDeliveryLng={get("deliveryLng")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DriverRecommendationList } from "@/components/customer/driver-recommendation-list"
import { Shield, Phone, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getRoleOverride } from "@/lib/role"

export default async function DriverRecommendationPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const roleOverride = await getRoleOverride()
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) {
    redirect("/")
  }

  // 배송 요청 정보 가져오기
  const { data: delivery } = await supabase
    .from("deliveries")
    .select("*")
    .eq("id", params.id)
    .eq("customer_id", user.id)
    .single()

  if (!delivery) {
    redirect("/customer")
  }

  // 근처 기사 찾기
  const pickupLat = delivery.pickup_location?.coordinates?.[1] || 37.5665
  const pickupLng = delivery.pickup_location?.coordinates?.[0] || 126.978

  const { data: nearbyDriversRaw } = await supabase.rpc("find_nearby_drivers", {
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    max_distance_km: 10.0,
    limit_count: 5,
  })

  // 기사 상세 정보 가져오기 (차량 정보, 보험 정보 포함)
  const nearbyDrivers = await Promise.all(
    (nearbyDriversRaw || []).map(async (driver: any) => {
      const { data: driverInfo } = await supabase
        .from("driver_info")
        .select("vehicle_type, vehicle_number, rating, total_deliveries, is_available")
        .eq("id", driver.driver_id)
        .single()

      const { data: driverProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", driver.driver_id)
        .single()

      return {
        id: driver.driver_id,
        full_name: driverProfile?.full_name || driver.driver_name || "기사",
        email: driverProfile?.email || "",
        vehicle_type: driverInfo?.vehicle_type || "일반",
        vehicle_number: driverInfo?.vehicle_number || "",
        rating: driverInfo?.rating || driver.rating || 5.0,
        total_deliveries: driverInfo?.total_deliveries || driver.total_deliveries || 0,
        is_available: driverInfo?.is_available !== false,
        distance_km: driver.distance_km || 0,
        has_insurance: true, // 플랫폼 보험 적용
      }
    })
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">근처 기사 추천</h1>
          <p className="text-muted-foreground">
            가까운 기사를 선택하여 연결 요청을 보내세요
          </p>
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <Phone className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            기사가 연결 요청을 수락하면 연락처가 공개됩니다. 
            요금은 카카오픽 기준으로 자동 산정됩니다.
          </AlertDescription>
        </Alert>

        {nearbyDrivers && nearbyDrivers.length > 0 ? (
          <DriverRecommendationList 
            drivers={nearbyDrivers} 
            deliveryId={params.id}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>근처 기사가 없습니다</CardTitle>
              <CardDescription>
                현재 위치 근처에 이용 가능한 기사가 없습니다. 
                잠시 후 다시 시도해주세요.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Shield className="h-5 w-5" />
              보험 안내
            </CardTitle>
          </CardHeader>
          <CardContent className="text-orange-800">
            <p className="text-sm">
              물품 파손·분실 시 플랫폼 보험으로 처리됩니다. 
              보상 한도는 약관에 명시되어 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

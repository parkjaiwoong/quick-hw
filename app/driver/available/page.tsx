import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getRoleOverride } from "@/lib/role"
import { AvailableDeliveries } from "@/components/driver/available-deliveries"
import { DriverStatusToggle } from "@/components/driver/driver-status-toggle"
import { ensureAndGetDriverInfo } from "@/lib/actions/driver"
import { RealtimeDeliveryNotifications } from "@/components/driver/realtime-delivery-notifications"
import { DriverDeliveryRequestProvider } from "@/lib/contexts/driver-delivery-request"

export default async function DriverAvailablePage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [{ data: profile }, roleOverride, ensureResult, { data: availableRows }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
    ensureAndGetDriverInfo(),
    supabase
      .from("deliveries")
      .select("id,pickup_address,delivery_address,distance_km,driver_fee,total_fee,vehicle_type,urgency,delivery_option,item_description,package_size,created_at")
      .eq("status", "pending")
      .is("driver_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  const driverInfo = ensureResult.driverInfo ?? null
  const available = availableRows ?? []

  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) {
    redirect("/")
  }

  // 배송가능 OFF 상태면 기사 메인(대시보드)으로 이동
  if (!driverInfo?.is_available) {
    redirect("/driver")
  }

  // 온보딩 가이드 미완료 시 가이드 페이지로 이동
  if (!driverInfo?.guide_completed_at) {
    redirect("/driver/guide")
  }

  return (
    <DriverDeliveryRequestProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
        <RealtimeDeliveryNotifications userId={user.id} isAvailable={driverInfo?.is_available ?? false} />
        <div className="w-full min-w-0 -mx-4 -my-2 px-1 py-1 space-y-2 md:-mx-6 md:-my-4 md:px-2 md:py-2">
          <Card className="border-0 shadow-sm w-full min-w-0">
            <CardHeader className="py-2 px-2 space-y-0">
              <div className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">대기 중인 배송</CardTitle>
                <DriverStatusToggle initialStatus={driverInfo?.is_available ?? false} redirectToOnTurnOff="/driver" />
              </div>
              <CardDescription className="text-xs">
                현재 {available.length}건의 수락 가능한 배송
              </CardDescription>
            </CardHeader>
            <CardContent className="py-2 px-2 pt-0 w-full min-w-0 overflow-hidden">
              <AvailableDeliveries deliveries={available} />
            </CardContent>
          </Card>
        </div>
      </div>
    </DriverDeliveryRequestProvider>
  )
}

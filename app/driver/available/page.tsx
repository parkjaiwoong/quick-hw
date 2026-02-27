import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getRoleOverride } from "@/lib/role"
import { AvailableDeliveries } from "@/components/driver/available-deliveries"
import { DriverStatusToggle } from "@/components/driver/driver-status-toggle"
import { getAvailableDeliveries, getDriverInfo } from "@/lib/actions/driver"
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

  const [{ data: profile }, roleOverride, { driverInfo }, { deliveries: available = [] }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
    getDriverInfo(),
    getAvailableDeliveries(),
  ])

  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) {
    redirect("/")
  }

  // 배송가능 OFF 상태면 기사 메인(대시보드)으로 이동
  if (!driverInfo?.is_available) {
    redirect("/driver")
  }

  return (
    <DriverDeliveryRequestProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
        <RealtimeDeliveryNotifications userId={user.id} isAvailable={driverInfo?.is_available ?? false} />
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex flex-row items-center justify-between gap-4">
                <CardTitle>대기 중인 배송</CardTitle>
                <DriverStatusToggle initialStatus={driverInfo?.is_available ?? false} redirectToOnTurnOff="/driver" />
              </div>
              <CardDescription>
                현재 {available.length}건의 수락 가능한 배송이 있습니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AvailableDeliveries deliveries={available} />
            </CardContent>
          </Card>
        </div>
      </div>
    </DriverDeliveryRequestProvider>
  )
}

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getRoleOverride } from "@/lib/role"
import Link from "next/link"
import { Button } from "@/components/ui/button"
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) {
    redirect("/")
  }

  const { driverInfo } = await getDriverInfo()
  const { deliveries: available = [] } = await getAvailableDeliveries()

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
                {driverInfo?.is_available
                  ? `현재 ${available.length}건의 수락 가능한 배송이 있습니다`
                  : "배송 가능을 켜면 고객 요청 목록이 표시됩니다"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {driverInfo?.is_available ? (
                <AvailableDeliveries deliveries={available} />
              ) : (
                <div className="text-center py-10 text-sm text-muted-foreground space-y-4">
                  <p>배송 가능을 켜면 고객 요청 목록이 표시됩니다.</p>
                  <Button asChild variant="outline">
                    <Link href="/driver">대시보드로 이동</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DriverDeliveryRequestProvider>
  )
}

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/cache/server-session"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getRoleOverride } from "@/lib/role"
import { AvailableDeliveries } from "@/components/driver/available-deliveries"
import { DriverStatusToggle } from "@/components/driver/driver-status-toggle"
import { ensureAndGetDriverInfo } from "@/lib/actions/driver"
import { fetchDriverAvailablePageRpc } from "@/lib/actions/page-bundle-rpc"
import { RealtimeDeliveryNotifications } from "@/components/driver/realtime-delivery-notifications"
import { DriverDeliveryRequestProvider } from "@/lib/contexts/driver-delivery-request"
import { parsePoint, haversineKm } from "@/lib/geo"

export default async function DriverAvailablePage() {
  const user = await getCachedAuthUser()
  if (!user) {
    redirect("/auth/login")
  }

  const [roleOverride, bundleRpc] = await Promise.all([getRoleOverride(), fetchDriverAvailablePageRpc()])

  let driverInfo: Record<string, unknown> | null = null
  let availableRows: { pickup_location?: unknown; [k: string]: unknown }[] = []

  if (bundleRpc.ok) {
    const d = bundleRpc.data
    driverInfo = d.driverInfo
    availableRows = (d.available as typeof availableRows) ?? []
    const canActAsDriver =
      roleOverride === "driver" || d.profileRole === "driver" || d.profileRole === "admin"
    if (!canActAsDriver) redirect("/")
  } else {
    const supabase = await getSupabaseServerClient()
    const [{ data: profile }, ensureResult, { data: rows }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      ensureAndGetDriverInfo(),
      supabase
        .from("deliveries")
        .select(
          "id,pickup_address,delivery_address,pickup_location,distance_km,driver_fee,total_fee,vehicle_type,urgency,delivery_option,item_description,package_size,created_at",
        )
        .eq("status", "pending")
        .is("driver_id", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ])
    driverInfo = (ensureResult.driverInfo as Record<string, unknown>) ?? null
    availableRows = rows ?? []
    const canActAsDriver =
      roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
    if (!canActAsDriver) redirect("/")
  }

  const driverCoords = parsePoint(driverInfo?.current_location ?? null)
  const available = availableRows.map((d) => {
    const pickupCoords = parsePoint(d.pickup_location)
    const pickupDistanceKm =
      driverCoords && pickupCoords ? haversineKm(driverCoords, pickupCoords) : null
    return { ...d, pickup_distance_km: pickupDistanceKm }
  })

  if (!driverInfo?.is_available) {
    redirect("/driver")
  }

  if (!driverInfo?.guide_completed_at) {
    redirect("/driver/guide")
  }

  return (
    <DriverDeliveryRequestProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
        <RealtimeDeliveryNotifications userId={user.id} isAvailable={Boolean(driverInfo?.is_available)} />
        <div className="w-full min-w-0 -mx-2 -my-2 px-0 py-1 space-y-2 md:-mx-3 md:-my-4 md:px-0 md:py-2">
          <Card className="border-0 shadow-sm w-full min-w-0">
            <CardHeader className="py-2 px-3 space-y-0">
              <div className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg leading-tight">
                  대기 중인
                  <br />
                  배송
                </CardTitle>
                <DriverStatusToggle initialStatus={Boolean(driverInfo?.is_available)} redirectToOnTurnOff="/driver" />
              </div>
              <CardDescription className="text-xs">현재 {available.length}건의 수락 가능한 배송</CardDescription>
            </CardHeader>
            <CardContent className="py-2 px-3 pt-0 w-full min-w-0 overflow-x-auto">
              <AvailableDeliveries deliveries={available} />
            </CardContent>
          </Card>
        </div>
      </div>
    </DriverDeliveryRequestProvider>
  )
}

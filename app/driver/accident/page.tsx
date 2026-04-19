import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/cache/server-session"
import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"
import { DriverAccidentReportClient } from "@/components/driver/driver-accident-report-client"
import { fetchDriverAccidentPageRpc } from "@/lib/actions/page-bundle-rpc"

export default async function DriverAccidentPage({
  searchParams,
}: {
  searchParams?: Promise<{ deliveryId?: string }>
}) {
  const user = await getCachedAuthUser()
  if (!user) redirect("/auth/login")

  const [roleOverride, sp, bundleRpc] = await Promise.all([
    getRoleOverride(),
    searchParams ?? Promise.resolve(undefined),
    fetchDriverAccidentPageRpc(),
  ])

  const deliveryId = sp?.deliveryId ?? null

  let deliveries: {
    id: string
    pickup_address?: string
    delivery_address?: string
    status: string
    created_at: string
  }[] = []
  let accidents: {
    id: string
    accident_type: string
    accident_description: string
    created_at: string
    status: string
    photos?: string[] | string | null
    delivery?: { pickup_address?: string; delivery_address?: string } | null
  }[] = []

  if (bundleRpc.ok) {
    const d = bundleRpc.data
    deliveries = d.deliveries
    accidents = d.accidents.map((a) => ({
      ...a,
      delivery: a.delivery
        ? { pickup_address: a.delivery.pickup_address, delivery_address: a.delivery.delivery_address }
        : null,
    }))
    const canActAsDriver =
      roleOverride === "driver" || d.profileRole === "driver" || d.profileRole === "admin"
    if (!canActAsDriver) redirect("/")
  } else {
    const supabase = await getSupabaseServerClient()
    const [{ data: profile }, { data: delRows }, { data: accRows }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("deliveries")
        .select("id, pickup_address, delivery_address, status, created_at")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("accident_reports")
        .select(
          "id, accident_type, accident_description, created_at, status, photos, delivery:deliveries(id, pickup_address, delivery_address)",
        )
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false }),
    ])
    const canActAsDriver =
      roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
    if (!canActAsDriver) redirect("/")
    deliveries = delRows ?? []
    accidents = (accRows ?? []) as typeof accidents
  }

  return (
    <DriverAccidentReportClient
      deliveries={deliveries}
      accidents={accidents}
      prefilledDeliveryId={deliveryId}
    />
  )
}

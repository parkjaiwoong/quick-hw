import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"
import { DriverAccidentReportClient } from "@/components/driver/driver-accident-report-client"

export default async function DriverAccidentPage({
  searchParams,
}: {
  searchParams?: Promise<{ deliveryId?: string }>
}) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: profile }, roleOverride, sp] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
    searchParams ?? Promise.resolve(undefined),
  ])

  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) redirect("/")

  const deliveryId = sp?.deliveryId ?? null

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, pickup_address, delivery_address, status, created_at")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  const { data: accidents } = await supabase
    .from("accident_reports")
    .select(
      "id, accident_type, accident_description, created_at, status, photos, delivery:deliveries(id, pickup_address, delivery_address)"
    )
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <DriverAccidentReportClient
      deliveries={deliveries ?? []}
      accidents={accidents ?? []}
      prefilledDeliveryId={deliveryId}
    />
  )
}

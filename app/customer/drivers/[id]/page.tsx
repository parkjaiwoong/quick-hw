import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"

/**
 * 기사는 '요청건 수락' 방식으로 배정됩니다.
 * 이 경로로 접근 시 배송 상세(기사 배정 대기)로 리다이렉트합니다.
 */
export default async function DriverRecommendationPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>
}) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) redirect("/")

  const deliveryId = typeof (params as { id?: string }).id === "string" ? (params as { id: string }).id : (await (params as Promise<{ id: string }>))?.id
  if (!deliveryId) redirect("/customer")

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id")
    .eq("id", deliveryId)
    .eq("customer_id", user.id)
    .maybeSingle()

  if (!delivery) redirect("/customer")

  redirect(`/customer/delivery/${deliveryId}`)
}

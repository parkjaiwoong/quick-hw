import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

/** 기사가 Realtime으로 알림은 받았는데 deliveries SELECT가 실패할 때(RLS/지연) 서버에서 배송 정보 조회 */
export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const deliveryId = searchParams.get("deliveryId")
  if (!deliveryId) {
    return NextResponse.json({ error: "deliveryId 필요" }, { status: 400 })
  }

  // 이 배송에 대한 알림이 이 기사(user_id)에게 있는지 확인
  const { data: notif } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", user.id)
    .eq("delivery_id", deliveryId)
    .in("type", ["new_delivery_request", "new_delivery"])
    .limit(1)
    .maybeSingle()

  if (!notif) {
    return NextResponse.json({ error: "해당 배송 알림이 없습니다." }, { status: 404 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    const { data: delivery, error } = await supabase
      .from("deliveries")
      .select("id, pickup_address, delivery_address, distance_km, total_fee, driver_fee")
      .eq("id", deliveryId)
      .single()
    if (error || !delivery) {
      return NextResponse.json({ error: error?.message ?? "배송 정보 없음" }, { status: 404 })
    }
    return NextResponse.json({ delivery, notificationId: notif.id })
  }

  const { createClient } = await import("@supabase/supabase-js")
  const service = createClient(
    process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  )
  const { data: delivery, error } = await service
    .from("deliveries")
    .select("id, pickup_address, delivery_address, distance_km, total_fee, driver_fee")
    .eq("id", deliveryId)
    .single()

  if (error || !delivery) {
    return NextResponse.json({ error: error?.message ?? "배송 정보 없음" }, { status: 404 })
  }
  return NextResponse.json({ delivery, notificationId: notif.id })
}

"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getAvailableDeliveries() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const { data, error } = await supabase
    .from("deliveries")
    .select("id,pickup_address,delivery_address,distance_km,driver_fee,total_fee,vehicle_type,urgency,delivery_option,item_description,package_size,created_at")
    .eq("status", "pending")
    .is("driver_id", null)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return { error: error.message }
  }

  return { deliveries: data }
}

export async function getMyAssignedDeliveries() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("driver_id", user.id)
    .in("status", ["accepted", "picked_up", "in_transit"])
    .order("accepted_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { deliveries: data }
}

export async function getMyDeliveryHistory() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("driver_id", user.id)
    .in("status", ["delivered", "cancelled"])
    .order("delivered_at", { ascending: false })
    .limit(50)

  if (error) {
    return { error: error.message }
  }

  return { deliveries: data }
}

/** 기사용: 미확인 신규 배송 요청 목록 (DB 직접 조회, 신규내용 표시/요청승낙용) */
export async function getDriverUnreadNewRequests() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { notifications: [] as { id: string; delivery_id: string; created_at: string }[] }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, delivery_id, created_at")
    .eq("user_id", user.id)
    .eq("is_read", false)
    .in("type", ["new_delivery_request", "new_delivery"])
    .not("delivery_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) return { notifications: [] }
  return { notifications: (data ?? []) as { id: string; delivery_id: string; created_at: string }[] }
}

export async function acceptDelivery(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // SECURITY DEFINER RPC로 원자적 처리
  // - PostgreSQL 행 잠금으로 동시 수락 시 첫 번째 기사만 성공
  // - driver_id IS NULL AND status = 'pending' 조건 만족 시에만 UPDATE
  const { data: result, error } = await supabase.rpc("accept_delivery", {
    p_delivery_id: deliveryId,
    p_driver_id: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  if (result === "already_taken") {
    return { error: "이미 다른 기사가 수락한 배송입니다." }
  }

  if (result === "not_found") {
    return { error: "존재하지 않는 배송입니다." }
  }

  // result === 'ok'
  const { syncOrderStatusForDelivery } = await import("@/lib/actions/finance")
  await syncOrderStatusForDelivery(deliveryId, "accepted")

  revalidatePath("/driver")
  revalidatePath(`/driver/delivery/${deliveryId}`)
  return { success: true }
}

export async function updateDeliveryStatus(deliveryId: string, status: string) {
  const supabase = await getSupabaseServerClient()

  const { data: current } = await supabase.from("deliveries").select("status, customer_id").eq("id", deliveryId).single()
  if (current?.status === "delivered") {
    return { error: "이미 배송 완료된 건은 변경할 수 없습니다." }
  }

  const updateData: Record<string, unknown> = { status }
  if (status === "picked_up") {
    updateData.picked_up_at = new Date().toISOString()
  } else if (status === "delivered") {
    updateData.delivered_at = new Date().toISOString()
  }

  // 상태 업데이트 먼저 실행
  const { error } = await supabase.from("deliveries").update(updateData).eq("id", deliveryId)
  if (error) return { error: error.message }

  // 배송 완료 시 후처리 (포인트, 정산, 주문상태 동기화) — 병렬 실행
  if (status === "delivered" && current?.customer_id) {
    const customerId = current.customer_id
    const { earnPoints, processReferralReward } = await import("@/lib/actions/points")
    const { createSettlementForDelivery, syncOrderStatusForDelivery } = await import("@/lib/actions/finance")

    // 첫 배송 완료 여부 확인 (추천인 보상용)
    const { data: customerDeliveries } = await supabase
      .from("deliveries")
      .select("id")
      .eq("customer_id", customerId)
      .eq("status", "delivered")

    const isFirstDelivery = customerDeliveries && customerDeliveries.length === 1

    await Promise.all([
      earnPoints(customerId, 100, "delivery", deliveryId, "배송 완료 포인트"),
      isFirstDelivery ? processReferralReward(customerId, deliveryId) : Promise.resolve(),
      createSettlementForDelivery(deliveryId),
      syncOrderStatusForDelivery(deliveryId, "delivered"),
    ])
  } else {
    const { syncOrderStatusForDelivery } = await import("@/lib/actions/finance")
    await syncOrderStatusForDelivery(deliveryId, status)
  }

  revalidatePath("/driver")
  revalidatePath(`/driver/delivery/${deliveryId}`)
  return { success: true }
}

/** accepted 상태에서 픽업완료 → 배송완료를 한 번에 처리 */
export async function completeDeliveryFromAccepted(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const { data: current } = await supabase
    .from("deliveries")
    .select("status, customer_id")
    .eq("id", deliveryId)
    .single()

  if (!current) return { error: "배송 정보를 찾을 수 없습니다." }
  if (current.status === "delivered") return { error: "이미 배송 완료된 건입니다." }

  const now = new Date().toISOString()

  // picked_up + delivered 를 한 번의 update로 처리
  const { error } = await supabase
    .from("deliveries")
    .update({ status: "delivered", picked_up_at: now, delivered_at: now })
    .eq("id", deliveryId)

  if (error) return { error: error.message }

  // 배송 완료 후처리
  if (current.customer_id) {
    const customerId = current.customer_id
    const { earnPoints, processReferralReward } = await import("@/lib/actions/points")
    const { createSettlementForDelivery, syncOrderStatusForDelivery } = await import("@/lib/actions/finance")

    const { data: customerDeliveries } = await supabase
      .from("deliveries")
      .select("id")
      .eq("customer_id", customerId)
      .eq("status", "delivered")

    const isFirstDelivery = customerDeliveries && customerDeliveries.length === 1

    await Promise.all([
      earnPoints(customerId, 100, "delivery", deliveryId, "배송 완료 포인트"),
      isFirstDelivery ? processReferralReward(customerId, deliveryId) : Promise.resolve(),
      createSettlementForDelivery(deliveryId),
      syncOrderStatusForDelivery(deliveryId, "delivered"),
    ])
  }

  revalidatePath("/driver")
  revalidatePath(`/driver/delivery/${deliveryId}`)
  return { success: true }
}

export async function updateDriverAvailability(isAvailable: boolean) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const { error } = await supabase.from("driver_info").update({ is_available: isAvailable }).eq("id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/driver")
  return { success: true }
}

export async function getDriverInfo() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const { data, error } = await supabase.from("driver_info").select("*").eq("id", user.id).single()

  if (error) {
    return { error: error.message }
  }

  return { driverInfo: data }
}

export async function ensureDriverInfoForUser() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { error: "Service Role Key가 설정되지 않았습니다." }
  }

  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)

  const { data: existingDriverInfo } = await supabaseService
    .from("driver_info")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

  if (!existingDriverInfo) {
    const { error: insertError } = await supabaseService.from("driver_info").insert({
      id: user.id,
      vehicle_type: null,
      vehicle_number: null,
      license_number: null,
      is_available: false,
    })

    if (insertError) {
      return { error: insertError.message }
    }
  }

  return { success: true }
}

export async function updateDriverLocation(lat: number, lng: number, deliveryId?: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // driver_info 테이블의 현재 위치 업데이트 (근처 기사 추천에 노출되도록)
  // PostgreSQL POINT 타입: (x,y) = (longitude, latitude)
  const { error: updateError } = await supabase
    .from("driver_info")
    .update({
      current_location: `(${lng},${lat})`,
    })
    .eq("id", user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  // 진행 중인 배송이 있으면 추적 기록 추가
  if (deliveryId) {
    const { error: trackingError } = await supabase.from("delivery_tracking").insert({
      delivery_id: deliveryId,
      driver_id: user.id,
      location: `(${lng},${lat})`,
    })

    if (trackingError) {
      console.error("Tracking error:", trackingError)
    }
  }

  return { success: true }
}

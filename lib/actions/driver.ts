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
    .select("*")
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

export async function acceptDelivery(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const { error } = await supabase
    .from("deliveries")
    .update({
      driver_id: user.id,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .is("driver_id", null)

  if (error) {
    return { error: error.message }
  }

  const { syncOrderStatusForDelivery } = await import("@/lib/actions/finance")
  await syncOrderStatusForDelivery(deliveryId, "accepted")

  revalidatePath("/driver")
  revalidatePath(`/driver/delivery/${deliveryId}`)
  return { success: true }
}

export async function updateDeliveryStatus(deliveryId: string, status: string) {
  const supabase = await getSupabaseServerClient()

  const updateData: any = {
    status,
  }

  if (status === "picked_up") {
    updateData.picked_up_at = new Date().toISOString()
  } else if (status === "delivered") {
    updateData.delivered_at = new Date().toISOString()
    
    // 배송 완료 시 포인트 적립 및 추천인 보상 처리
    const { data: delivery } = await supabase.from("deliveries").select("*").eq("id", deliveryId).single()
    
    if (delivery && delivery.customer_id) {
      // 포인트 적립 (배송 완료 시 100포인트)
      const { earnPoints } = await import("@/lib/actions/points")
      await earnPoints(delivery.customer_id, 100, "delivery", deliveryId, "배송 완료 포인트")
      
      // 첫 배송 완료인지 확인하여 추천인 보상 처리
      const { data: customerDeliveries } = await supabase
        .from("deliveries")
        .select("id")
        .eq("customer_id", delivery.customer_id)
        .eq("status", "delivered")
      
      if (customerDeliveries && customerDeliveries.length === 1) {
        // 첫 배송 완료
        const { processReferralReward } = await import("@/lib/actions/points")
        await processReferralReward(delivery.customer_id, deliveryId)
      }
    }

    const { createSettlementForDelivery, syncOrderStatusForDelivery } = await import("@/lib/actions/finance")
    await createSettlementForDelivery(deliveryId)
    await syncOrderStatusForDelivery(deliveryId, "delivered")
  }

  const { error } = await supabase.from("deliveries").update(updateData).eq("id", deliveryId)

  if (error) {
    return { error: error.message }
  }

  const { syncOrderStatusForDelivery } = await import("@/lib/actions/finance")
  await syncOrderStatusForDelivery(deliveryId, status)

  revalidatePath("/driver")
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

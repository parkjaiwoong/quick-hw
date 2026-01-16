"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface CreateDeliveryData {
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  pickupContactName: string
  pickupContactPhone: string
  pickupNotes?: string

  deliveryAddress: string
  deliveryLat: number
  deliveryLng: number
  deliveryContactName: string
  deliveryContactPhone: string
  deliveryNotes?: string

  itemType: string
  itemDescription?: string
  itemWeight?: number
  packageSize?: string
}

export async function createDelivery(data: CreateDeliveryData) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // 거리 계산 (하버사인 공식으로 직접 계산, RPC 실패 대비)
  let distanceKm = 0
  try {
    const { data: distanceData, error: distanceError } = await supabase.rpc("calculate_distance", {
      lat1: data.pickupLat,
      lon1: data.pickupLng,
      lat2: data.deliveryLat,
      lon2: data.deliveryLng,
    })

    if (distanceError) {
      console.warn("RPC 거리 계산 실패, 클라이언트 측 계산으로 대체:", distanceError)
      // 클라이언트 측 거리 계산 (하버사인 공식)
      const R = 6371 // 지구 반지름 (km)
      const dLat = ((data.deliveryLat - data.pickupLat) * Math.PI) / 180
      const dLng = ((data.deliveryLng - data.pickupLng) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((data.pickupLat * Math.PI) / 180) *
          Math.cos((data.deliveryLat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      distanceKm = Math.round(R * c * 10) / 10
    } else {
      distanceKm = distanceData as number
    }
  } catch (error) {
    console.error("거리 계산 오류:", error)
    return { error: "거리 계산에 실패했습니다. 위도/경도를 확인해주세요." }
  }

  // 요금 계산 (카카오픽 방식: 기본요금 + 2km 초과분 km당 요금)
  const { data: pricing } = await supabase
    .from("pricing_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const baseFee = Number(pricing?.base_fee ?? 4000)
  const perKmFee = Number(pricing?.per_km_fee ?? 1000)
  const commissionRate = Number(pricing?.platform_commission_rate ?? 0)
  const minDriverFee = Number(pricing?.min_driver_fee ?? 0)
  const includedDistanceKm = 2

  const distanceFee = Math.max(0, distanceKm - includedDistanceKm) * perKmFee
  const totalFee = baseFee + distanceFee
  let platformFee = Math.round((totalFee * commissionRate) / 100)
  let driverFee = Math.max(totalFee - platformFee, minDriverFee)
  if (driverFee + platformFee > totalFee) {
    platformFee = Math.max(0, totalFee - driverFee)
  }

  // PostgreSQL POINT 타입은 (lng,lat) 형식으로 입력해야 함
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .insert({
      customer_id: user.id,
      pickup_address: data.pickupAddress,
      pickup_location: `(${data.pickupLng},${data.pickupLat})`,
      pickup_contact_name: data.pickupContactName,
      pickup_contact_phone: data.pickupContactPhone,
      pickup_notes: data.pickupNotes,
      delivery_address: data.deliveryAddress,
      delivery_location: `(${data.deliveryLng},${data.deliveryLat})`,
      delivery_contact_name: data.deliveryContactName,
      delivery_contact_phone: data.deliveryContactPhone,
      delivery_notes: data.deliveryNotes,
      item_description: data.itemDescription || data.itemType,
      item_weight: data.itemWeight,
      package_size: data.packageSize,
      distance_km: distanceKm,
      base_fee: baseFee,
      distance_fee: distanceFee,
      total_fee: totalFee,
      driver_fee: driverFee,
      platform_fee: platformFee,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  const { data: nearbyDrivers } = await supabase.rpc("find_nearby_drivers", {
    pickup_lat: data.pickupLat,
    pickup_lng: data.pickupLng,
    max_distance_km: 10.0,
    limit_count: 5,
  })

  revalidatePath("/customer")
  return {
    success: true,
    delivery,
    nearbyDriversCount: nearbyDrivers?.length || 0,
    nearbyDrivers: nearbyDrivers || [],
  }
}

export async function getMyDeliveries() {
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
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { deliveries: data }
}
 
export async function cancelDelivery(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const { error } = await supabase
    .from("deliveries")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/customer")
  return { success: true }
}

export async function rateDelivery(deliveryId: string, rating: number, review?: string) {
  const supabase = await getSupabaseServerClient()

  const { error } = await supabase
    .from("deliveries")
    .update({
      customer_rating: rating,
      customer_review: review,
    })
    .eq("id", deliveryId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/customer")
  return { success: true }
}

export async function getNearbyDrivers(pickupLat: number, pickupLng: number) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase.rpc("find_nearby_drivers", {
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    max_distance_km: 10.0,
    limit_count: 10,
  })

  if (error) {
    return { error: error.message }
  }

  return { drivers: data }
}

export async function requestDriverConnection(deliveryId: string, driverId: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // 배송 요청에 기사 할당 (pending 상태 유지)
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .update({
      driver_id: driverId,
      // status는 여전히 pending - 기사가 수락해야 accepted
    })
    .eq("id", deliveryId)
    .eq("customer_id", user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // 기사에게 알림 전송 (notifications 테이블에 추가)
  const { error: notificationError } = await supabase.from("notifications").insert({
    user_id: driverId,
    delivery_id: deliveryId,
    title: "새로운 배송 연결 요청",
    message: `고객으로부터 배송 연결 요청이 들어왔습니다. 거리: ${delivery.distance_km?.toFixed(1) || 0}km`,
    type: "new_delivery_request",
  })
  
  if (notificationError) {
    console.error("알림 생성 오류:", notificationError)
    // 알림 실패해도 요청은 성공으로 처리
  }

  revalidatePath("/customer")
  return { success: true, delivery }
}

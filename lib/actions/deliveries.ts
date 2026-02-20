"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { resolveRiderForOrder } from "@/lib/actions/rider-referral"
import { calculateDeliveryFee } from "@/lib/pricing"

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
  paymentMethod?: string
  customerAmount?: number

  deliveryOption?: string
  vehicleType?: string
  urgency?: string
  scheduledPickupAt?: string
}

/** 감사 로그 기록 (실패해도 메인 흐름은 유지) */
async function writeAuditLog(
  service: { from: (t: string) => { insert: (r: object) => Promise<{ error: unknown }> } },
  deliveryId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  try {
    await service.from("notification_audit_log").insert({
      delivery_id: deliveryId,
      event_type: eventType,
      payload,
    })
  } catch (_) {}
}

/** 결제 완료 후 기사에게 Realtime 알림(INSERT notifications). createDelivery(현금) 또는 payment confirm(카드/계좌이체)에서 호출 */
export async function notifyDriversForDelivery(
  deliveryId: string,
  pickupLat: number,
  pickupLng: number
): Promise<{ error?: string }> {
  console.log("[기사알림-1] notifyDriversForDelivery 시작", { deliveryId, pickupLat, pickupLng })
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error("[기사알림-1] 서비스 키 없음")
    return { error: "서비스 키 없음" }
  }

  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  const service = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)

  await writeAuditLog(service, deliveryId, "notify_start", { pickup_lat: pickupLat, pickup_lng: pickupLng })

  // RPC는 반드시 service role로 호출 (고객 세션으로 호출 시 RLS로 driver_info 조회 불가 → 기사 0명)
  const { data: nearbyDrivers, error: rpcError } = await service.rpc("find_nearby_drivers", {
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    max_distance_km: 10.0,
    limit_count: 5,
  })
  if (rpcError) {
    console.error("[기사알림-2] find_nearby_drivers RPC 오류:", rpcError.message)
    await writeAuditLog(service, deliveryId, "rpc_error", { error: rpcError.message })
  }
  const nearbyIds = (nearbyDrivers?.length ?? 0) > 0
    ? (nearbyDrivers as { driver_id?: string; id?: string }[]).map((d) => d.driver_id ?? d.id).filter(Boolean)
    : []
  await writeAuditLog(service, deliveryId, "rpc_nearby", {
    nearby_count: nearbyDrivers?.length ?? 0,
    driver_ids: nearbyIds,
  })
  console.log("[기사알림-2] 근처 기사 수:", nearbyDrivers?.length ?? 0, "driver_ids:", nearbyIds)

  // 배송 가능(is_available=true) 전원 조회 (위치 없음 포함)
  const { data: availableDrivers } = await service
    .from("driver_info")
    .select("id")
    .eq("is_available", true)
  const allAvailableIds = (availableDrivers ?? []).map((d) => d.id)

  // 근처 5명 이하일 때는 배송 가능 전원에게 FCM (위치 없어도 포함). 6명 이상이면 근처만(현재 RPC limit=5라 항상 5명 이하).
  let driverIdsToNotify: string[]
  if (nearbyIds.length <= 5) {
    const merged = new Set<string>([...nearbyIds, ...allAvailableIds])
    driverIdsToNotify = Array.from(merged)
    await writeAuditLog(service, deliveryId, "merge_nearby_and_available", {
      nearby_count: nearbyIds.length,
      available_count: allAvailableIds.length,
      merged_count: driverIdsToNotify.length,
      driver_ids: driverIdsToNotify,
    })
    console.log("[기사알림-2] 근처 5명 이하 → 배송가능 전원에게 알림 (위치 없음 포함)", { merged: driverIdsToNotify.length, nearby: nearbyIds.length, available: allAvailableIds.length })
  } else {
    driverIdsToNotify = nearbyIds
    console.log("[기사알림-2] 근처 6명 이상 → 근처만 알림:", driverIdsToNotify.length)
  }

  if (driverIdsToNotify.length === 0) {
    console.warn("[기사알림-2] 알림할 기사 0명 — INSERT 스킵 (is_available=true인 기사 0명)")
    await writeAuditLog(service, deliveryId, "insert_skip", { reason: "알림할 기사 0명" })
    return {}
  }

  const rows = driverIdsToNotify.map((driverId) => ({
    user_id: driverId,
    delivery_id: deliveryId,
    title: "새로운 배송 요청",
    message: "새 배송 요청이 등록되었습니다. 수락 가능한 배송 목록에서 확인하세요.",
    type: "new_delivery_request",
  }))
  const { error: notifError } = await service.from("notifications").insert(rows)
  if (notifError) {
    console.error("[기사알림-3] notifications INSERT 실패:", notifError.message, { deliveryId, driverIds: driverIdsToNotify })
    await writeAuditLog(service, deliveryId, "insert_fail", {
      error: notifError.message,
      driver_count: driverIdsToNotify.length,
      driver_ids: driverIdsToNotify,
    })
    return { error: notifError.message }
  }
  await writeAuditLog(service, deliveryId, "insert_ok", {
    driver_count: driverIdsToNotify.length,
    driver_ids: driverIdsToNotify,
  })
  console.log("[기사알림-3] notifications INSERT 성공", { deliveryId, driverCount: driverIdsToNotify.length, driverIds: driverIdsToNotify })

  // 웹훅 없이도 FCM 전송: 서버에서 /api/push/send 직접 호출 (기사 앱 수신 보장)
  const pushSecret = process.env.PUSH_WEBHOOK_SECRET
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://quick-hw.vercel.app"
  if (pushSecret && baseUrl) {
    const pushUrl = `${baseUrl}/api/push/send`
    for (const driverId of driverIdsToNotify) {
      try {
        const res = await fetch(pushUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": pushSecret,
          },
          body: JSON.stringify({
            record: {
              user_id: driverId,
              delivery_id: deliveryId,
              title: "새로운 배송 요청",
              message: "새 배송 요청이 등록되었습니다. 수락 가능한 배송 목록에서 확인하세요.",
              type: "new_delivery_request",
            },
          }),
        })
        const text = await res.text()
        console.log("[기사알림-4] push/send 호출", { driverId, status: res.status, body: text })
      } catch (e) {
        console.error("[기사알림-4] push/send 호출 실패", { driverId, error: (e as Error).message })
      }
    }
  } else {
    console.warn("[기사알림-4] PUSH_WEBHOOK_SECRET 또는 baseUrl 없음 — FCM 직접 호출 스킵 (웹훅에만 의존)")
  }
  return {}
}

export async function createDelivery(data: CreateDeliveryData) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // orders.customer_id_fkey: 주문 생성 전에 profiles(또는 customer)에 고객 행이 있어야 함. 서비스 롤로 확실히 생성.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const service = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)
    const email = (user.email?.trim() || "").length > 0 ? user.email! : `${user.id}@profile.placeholder`
    const fullName = (user.user_metadata as { full_name?: string })?.full_name ?? user.email ?? "고객"

    const { data: existingProfile } = await service.from("profiles").select("id").eq("id", user.id).maybeSingle()
    if (!existingProfile) {
      const { error: profileError } = await service.from("profiles").insert({
        id: user.id,
        email,
        full_name: fullName,
        role: "customer",
      })
      if (profileError) {
        return { error: "프로필을 생성할 수 없습니다. 다시 로그인하거나 관리자에게 문의하세요." }
      }
    }

    // 일부 스키마는 orders.customer_id가 customer(id)를 참조함
    const { data: existingCustomer } = await service.from("customer").select("id").eq("id", user.id).maybeSingle()
    if (!existingCustomer) {
      const { error: customerInsertError } = await service.from("customer").insert({
        id: user.id,
        name: fullName || "고객",
        email: email || null,
        phone: null,
      })
      if (customerInsertError) {
        // customer 테이블이 없거나 스키마가 다르면 무시 (orders FK가 profiles만 참조할 수 있음)
      }
    }
  } else {
    const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle()
    if (!existingProfile) {
      const email = (user.email?.trim() || "").length > 0 ? user.email! : `${user.id}@profile.placeholder`
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        email,
        full_name: (user.user_metadata as { full_name?: string })?.full_name ?? user.email ?? "",
        role: "customer",
      })
      if (profileError) {
        return { error: "프로필을 생성할 수 없습니다. 다시 로그인하거나 관리자에게 문의하세요." }
      }
    }
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
  const quotedTotalFee = calculateDeliveryFee({
    baseFee,
    perKmFee,
    includedDistanceKm,
    distanceKm,
    itemType: data.itemType || undefined,
    itemWeightKg: data.itemWeight,
    packageSize: data.packageSize,
  })
  const adjustedAmount = Number.isFinite(Number(data.customerAmount))
    ? Math.round(Number(data.customerAmount))
    : quotedTotalFee
  const totalFee = Math.round(adjustedAmount > 0 ? adjustedAmount : quotedTotalFee)
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
      referring_rider_id: (await resolveRiderForOrder(user.id)).riderId || null,
      status: "pending",
      delivery_option: data.deliveryOption || "immediate",
      vehicle_type: data.vehicleType || "motorcycle",
      urgency: data.urgency || "standard",
      scheduled_pickup_at: data.scheduledPickupAt ? new Date(data.scheduledPickupAt).toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  const { createOrderAndPaymentForDelivery } = await import("@/lib/actions/finance")
  const paymentMethodNormalized =
    data.paymentMethod === "card" || data.paymentMethod === "cash" || data.paymentMethod === "bank_transfer"
      ? data.paymentMethod
      : "card"
  const orderResult = await createOrderAndPaymentForDelivery({
    deliveryId: delivery.id,
    customerId: user.id,
    amount: totalFee,
    paymentMethod: paymentMethodNormalized,
    customerAdjustedAmount: adjustedAmount !== quotedTotalFee ? adjustedAmount : null,
  })
  if (orderResult?.error) {
    return { error: orderResult.error }
  }

  const { data: nearbyDrivers } = await supabase.rpc("find_nearby_drivers", {
    pickup_lat: data.pickupLat,
    pickup_lng: data.pickupLng,
    max_distance_km: 10.0,
    limit_count: 5,
  })

  // 현금 결제만 즉시 기사 알림. 카드/계좌이체는 결제 완료 후 confirm 쪽에서 notifyDriversForDelivery 호출
  const shouldNotifyNow = paymentMethodNormalized === "cash"
  if (shouldNotifyNow) {
    const notifyResult = await notifyDriversForDelivery(delivery.id, data.pickupLat, data.pickupLng)
    if (notifyResult.error) {
      console.error("[createDelivery] 기사 알림 실패:", notifyResult.error)
    }
  }

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
    .select(
      `
      *,
      orders:orders!orders_delivery_id_fkey(order_amount, order_status, payment_method),
      payments:payments!payments_delivery_id_fkey(status, amount, payment_method)
    `,
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { deliveries: data }
}

export async function getDeliveriesByCustomerId(customerId: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") {
    return { error: "관리자 권한이 필요합니다" }
  }

  const { data, error } = await supabase
    .from("deliveries")
    .select(
      `
      *,
      orders:orders!orders_delivery_id_fkey(order_amount, order_status, payment_method),
      payments:payments!payments_delivery_id_fkey(status, amount, payment_method)
    `,
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { deliveries: data }
}
 
export async function cancelDelivery(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, status")
    .eq("id", deliveryId)
    .single()

  if (!delivery) {
    return { error: "배송 정보를 찾을 수 없습니다" }
  }

  const isStarted = ["picked_up", "in_transit", "delivered"].includes(delivery.status)
  const { cancelPaymentForDelivery, refundPaymentForDelivery, excludeSettlementForDelivery } = await import(
    "@/lib/actions/finance"
  )

  if (isStarted) {
    const refundResult = await refundPaymentForDelivery(deliveryId)
    if (!refundResult.success && refundResult.error) return { error: refundResult.error }
    await excludeSettlementForDelivery(deliveryId, "배송 시작 이후 취소")
  } else {
    const cancelResult = await cancelPaymentForDelivery(deliveryId)
    if (!cancelResult.success && cancelResult.error) return { error: cancelResult.error }
  }

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

function parsePickupLatLng(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null
  if (typeof location === "string") {
    const m = location.match(/\(([^,]+),([^)]+)\)/)
    if (!m) return null
    const lng = Number(m[1])
    const lat = Number(m[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    return null
  }
  const o = location as { x?: number; y?: number; 0?: number; 1?: number }
  const lng = o?.x ?? o?.[0]
  const lat = o?.y ?? o?.[1]
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return null
}

/** 추천 기사 목록 (DriverRecommendationList용 포맷). notifyDriversForDelivery와 동일하게,
 * 근처 기사(위치 있음) + 배송가능 전원(위치 없음 포함)을 합쳐서 표시 */
export async function getRecommendedDriversForDelivery(delivery: { pickup_location?: unknown }) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_QUICKSUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) return { drivers: [] }

  const { createClient } = await import("@supabase/supabase-js")
  const service = createClient(supabaseUrl, serviceRoleKey)

  const coords = parsePickupLatLng(delivery.pickup_location)

  // 1) 근처 기사 (위치 있음, 반경 10km 이내)
  let nearbyList: { id: string; full_name: string; vehicle_type: string; rating: number; total_deliveries: number; distance_km: number }[] = []
  if (coords) {
    const { data: raw } = await service.rpc("find_nearby_drivers", {
      pickup_lat: coords.lat,
      pickup_lng: coords.lng,
      max_distance_km: 10.0,
      limit_count: 10,
    })
    nearbyList = (raw ?? []).map((r: { driver_id?: string; driver_name?: string; distance_km?: number; rating?: number; total_deliveries?: number; vehicle_type?: string }) => ({
      id: r.driver_id ?? "",
      full_name: r.driver_name ?? "기사",
      vehicle_type: r.vehicle_type ?? "일반",
      rating: Number(r.rating ?? 5),
      total_deliveries: Number(r.total_deliveries ?? 0),
      distance_km: Number(r.distance_km ?? 0),
    }))
  }

  // 2) 배송가능 전원 (위치 없음 포함) - RLS 우회를 위해 service role 사용
  const { data: availableRows } = await service
    .from("driver_info")
    .select("id, rating, total_deliveries, vehicle_type")
    .eq("is_available", true)
  const availableIds = (availableRows ?? []).map((r) => r.id)
  if (availableIds.length === 0) {
    return { drivers: nearbyList.map((r) => ({ ...r, is_available: true, has_insurance: false })) }
  }

  const { data: profiles } = await service.from("profiles").select("id, full_name").in("id", availableIds)
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "기사"]))

  const nearbyIds = new Set(nearbyList.map((r) => r.id))
  const alreadyIncluded = new Set<string>(nearbyIds)

  // 3) 근처에 없는 배송가능 기사 추가 (거리 0 = 위치 정보 없음)
  for (const row of availableRows ?? []) {
    if (alreadyIncluded.has(row.id)) continue
    alreadyIncluded.add(row.id)
    nearbyList.push({
      id: row.id,
      full_name: profileMap.get(row.id) ?? "기사",
      vehicle_type: row.vehicle_type ?? "일반",
      rating: Number(row.rating ?? 5),
      total_deliveries: Number(row.total_deliveries ?? 0),
      distance_km: 0, // 위치 없음
    })
  }

  const drivers = nearbyList.map((r) => ({
    ...r,
    is_available: true,
    has_insurance: false,
  }))

  return { drivers }
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
  const title = "새로운 배송 연결 요청"
  const message = `고객으로부터 배송 연결 요청이 들어왔습니다. 거리: ${delivery.distance_km?.toFixed(1) || 0}km`
  const { error: notificationError } = await supabase.from("notifications").insert({
    user_id: driverId,
    delivery_id: deliveryId,
    title,
    message,
    type: "new_delivery_request",
  })

  if (notificationError) {
    console.error("알림 생성 오류:", notificationError)
    // 알림 실패해도 요청은 성공으로 처리
  }

  // 웹훅 없이도 FCM 전송: 서버에서 /api/push/send 직접 호출 (고객이 기사 선택 시 즉시 푸시 보장)
  const pushSecret = process.env.PUSH_WEBHOOK_SECRET
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://quick-hw.vercel.app"
  if (pushSecret && baseUrl) {
    try {
      const pushUrl = `${baseUrl}/api/push/send`
      const res = await fetch(pushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": pushSecret,
        },
        body: JSON.stringify({
          record: {
            user_id: driverId,
            delivery_id: deliveryId,
            title,
            message,
            type: "new_delivery_request",
          },
        }),
      })
      const text = await res.text()
      if (res.status !== 200) {
        console.error("[고객→기사연결] push/send 실패", { driverId, status: res.status, body: text })
      } else {
        let fcmStatus = "?"
        try {
          const json = JSON.parse(text) as { fcm?: string }
          fcmStatus = json.fcm ?? "응답에 fcm 없음"
        } catch {
          fcmStatus = text
        }
        console.log("[고객→기사연결] push/send 성공", { driverId, fcm: fcmStatus })
      }
    } catch (e) {
      console.error("[고객→기사연결] push/send 호출 실패", { driverId, error: (e as Error).message })
    }
  } else {
    if (!pushSecret) {
      console.warn("[고객→기사연결] PUSH_WEBHOOK_SECRET 없음 — FCM 전송 스킵 (Vercel/.env.local에 설정 필요)")
    }
    if (!baseUrl) {
      console.warn("[고객→기사연결] baseUrl 없음 — FCM 전송 스킵")
    }
  }

  revalidatePath("/customer")
  return { success: true, delivery }
}

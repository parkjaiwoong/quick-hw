"use server"

import { after } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const BUCKET_DELIVERY_PROOFS = "delivery-proofs"

function getServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, key, {
    auth: { persistSession: false },
  })
}

/** delivery-proofs 버킷이 없으면 서비스 롤로 생성 (업로드 실패 시 1회 자동 시도용) */
async function ensureDeliveryProofsBucket(): Promise<{ ok: boolean; error?: string }> {
  const client = getServiceRoleClient()
  if (!client) return { ok: false, error: "SERVICE_ROLE 없음" }
  const { error } = await client.storage.createBucket(BUCKET_DELIVERY_PROOFS, {
    public: true,
    fileSizeLimit: "5MB",
  })
  if (error) {
    if (String(error).includes("already exists") || String(error).includes("duplicate")) return { ok: true }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

function decodeBase64ToUint8Array(base64: string): Uint8Array | null {
  try {
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(base64, "base64"))
    }
    const binary = atob(base64)
    const arr = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
    return arr
  } catch {
    return null
  }
}

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

/** 기사: 배송 완료 인증 사진 업로드 → public URL 반환 */
export async function uploadDeliveryProof(deliveryId: string, formData: FormData) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다." }

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("driver_id")
    .eq("id", deliveryId)
    .single()
  if (!delivery || delivery.driver_id !== user.id) {
    return { error: "이 배송의 담당 기사만 사진을 업로드할 수 있습니다." }
  }

  const file = formData.get("file") as File | null
  if (!file || file.size === 0) return { error: "파일을 선택해주세요." }
  if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(file.type)) {
    return { error: "JPG, PNG, WEBP, HEIC 형식만 업로드 가능합니다." }
  }
  if (file.size > 5 * 1024 * 1024) return { error: "파일 크기는 5MB 이하여야 합니다." }

  const svc = getServiceRoleClient()
  const client = svc ?? supabase

  const ext = file.name.split(".").pop() || "jpg"
  const path = `${deliveryId}/${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  let uploadError = (await client.storage.from(BUCKET_DELIVERY_PROOFS).upload(path, buffer, { contentType: file.type, upsert: true })).error
  if (uploadError) {
    const msg = uploadError.message || String(uploadError)
    const isBucketMissing = msg.includes("Bucket not found") || msg.includes("bucket") || msg.includes("not found")
    if (isBucketMissing && getServiceRoleClient()) {
      const ensured = await ensureDeliveryProofsBucket()
      if (ensured.ok) {
        uploadError = (await client.storage.from(BUCKET_DELIVERY_PROOFS).upload(path, buffer, { contentType: file.type, upsert: true })).error
      }
    }
  }
  if (uploadError) {
    const msg = uploadError.message || String(uploadError)
    return { error: msg.includes("row-level security") || msg.includes("policy")
      ? "저장소 권한이 없습니다. Supabase 대시보드에서 delivery-proofs 버킷과 저장 정책을 확인해 주세요."
      : "파일 업로드에 실패했습니다." }
  }

  const { data: urlData } = client.storage.from(BUCKET_DELIVERY_PROOFS).getPublicUrl(path)
  return { success: true, url: urlData.publicUrl }
}

/** Base64 dataUrl 업로드 (WebView FormData 이슈 회피용) */
export async function uploadDeliveryProofFromBase64(deliveryId: string, dataUrl: string) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다." }

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("driver_id")
    .eq("id", deliveryId)
    .single()
  if (!delivery || delivery.driver_id !== user.id) {
    return { error: "이 배송의 담당 기사만 사진을 업로드할 수 있습니다." }
  }

  const match = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/)
  if (!match) return { error: "지원하지 않는 이미지 형식입니다." }
  const [, ext, base64] = match
  const extMap = { jpeg: "jpg", png: "png", webp: "webp" } as const
  const contentType = `image/${ext}`
  const suffix = extMap[ext as keyof typeof extMap] ?? "png"

  const raw = decodeBase64ToUint8Array(base64)
  if (!raw || raw.length === 0) return { error: "파일이 비어 있습니다." }
  if (raw.length > 5 * 1024 * 1024) return { error: "파일 크기는 5MB 이하여야 합니다." }

  const svc = getServiceRoleClient()
  const client = svc ?? supabase
  const path = `${deliveryId}/${Date.now()}.${suffix}`

  let uploadError = (await client.storage.from(BUCKET_DELIVERY_PROOFS).upload(path, raw, { contentType, upsert: true })).error
  if (uploadError) {
    const msg = uploadError.message || String(uploadError)
    const isBucketMissing = msg.includes("Bucket not found") || msg.includes("bucket") || msg.includes("not found")
    if (isBucketMissing && getServiceRoleClient()) {
      const ensured = await ensureDeliveryProofsBucket()
      if (ensured.ok) {
        uploadError = (await client.storage.from(BUCKET_DELIVERY_PROOFS).upload(path, raw, { contentType, upsert: true })).error
      }
    }
  }
  if (uploadError) {
    const msg = uploadError.message || String(uploadError)
    if (msg.includes("Bucket not found") || msg.includes("bucket") || msg.includes("not found"))
      return { error: "저장 버킷(delivery-proofs)이 없습니다. Supabase Storage에서 버킷을 생성해 주세요." }
    if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("violates"))
      return { error: "저장소 권한이 없습니다. Supabase에서 delivery-proofs 버킷 저장 정책을 추가해 주세요." }
    return { error: "파일 업로드에 실패했습니다." }
  }

  const { data: urlData } = client.storage.from(BUCKET_DELIVERY_PROOFS).getPublicUrl(path)
  return { success: true, url: urlData.publicUrl }
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: string,
  deliveryProofUrl?: string
) {
  const supabase = await getSupabaseServerClient()

  const { data: current } = await supabase
    .from("deliveries")
    .select("status, customer_id, driver_id")
    .eq("id", deliveryId)
    .single()
  if (current?.status === "delivered") {
    return { error: "이미 배송 완료된 건은 변경할 수 없습니다." }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다." }
  if (current?.driver_id && current.driver_id !== user.id) {
    return { error: "이 배송의 담당 기사만 완료 처리할 수 있습니다." }
  }

  const updateData: Record<string, unknown> = { status }
  if (status === "picked_up") {
    updateData.picked_up_at = new Date().toISOString()
  } else if (status === "delivered") {
    updateData.delivered_at = new Date().toISOString()
    if (deliveryProofUrl) updateData.delivery_proof_url = deliveryProofUrl
  }

  // 상태 업데이트 먼저 실행
  const { error } = await supabase.from("deliveries").update(updateData).eq("id", deliveryId)
  if (error) return { error: error.message }

  const { syncOrderStatusForDelivery } = await import("@/lib/actions/finance")
  await syncOrderStatusForDelivery(deliveryId, status)

  // 배송 완료 시 포인트·정산·추천인·캐시 무효화는 after()로 즉시 응답 후 백그라운드 처리
  if (status === "delivered" && current?.customer_id) {
    const customerId = current.customer_id
    after(async () => {
      const { earnPoints, processReferralReward } = await import("@/lib/actions/points")
      const { createSettlementForDelivery } = await import("@/lib/actions/finance")
      const { revalidatePath } = await import("next/cache")
      const s = await getSupabaseServerClient()
      const { data: customerDeliveries } = await s
        .from("deliveries")
        .select("id")
        .eq("customer_id", customerId)
        .eq("status", "delivered")
      const isFirstDelivery = customerDeliveries && customerDeliveries.length === 1
      await Promise.all([
        earnPoints(customerId, 100, "delivery", deliveryId, "배송 완료 포인트"),
        isFirstDelivery ? processReferralReward(customerId, deliveryId) : Promise.resolve(),
        createSettlementForDelivery(deliveryId),
      ])
      revalidatePath("/driver")
      revalidatePath(`/driver/delivery/${deliveryId}`)
      revalidatePath(`/customer/delivery/${deliveryId}`)
    })
  } else {
    revalidatePath("/driver")
    revalidatePath(`/driver/delivery/${deliveryId}`)
    revalidatePath(`/customer/delivery/${deliveryId}`)
  }

  return { success: true }
}

/** accepted 상태에서 픽업완료 → 배송완료를 한 번에 처리 */
export async function completeDeliveryFromAccepted(
  deliveryId: string,
  deliveryProofUrl?: string
) {
  const supabase = await getSupabaseServerClient()

  const { data: current } = await supabase
    .from("deliveries")
    .select("status, customer_id")
    .eq("id", deliveryId)
    .single()

  if (!current) return { error: "배송 정보를 찾을 수 없습니다." }
  if (current.status === "delivered") return { error: "이미 배송 완료된 건입니다." }

  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = {
    status: "delivered",
    picked_up_at: now,
    delivered_at: now,
  }
  if (deliveryProofUrl) updatePayload.delivery_proof_url = deliveryProofUrl

  const { error } = await supabase
    .from("deliveries")
    .update(updatePayload)
    .eq("id", deliveryId)

  if (error) return { error: error.message }

  const { syncOrderStatusForDelivery } = await import("@/lib/actions/finance")
  await syncOrderStatusForDelivery(deliveryId, "delivered")

  if (current.customer_id) {
    const customerId = current.customer_id
    after(async () => {
      const { earnPoints, processReferralReward } = await import("@/lib/actions/points")
      const { createSettlementForDelivery } = await import("@/lib/actions/finance")
      const { revalidatePath } = await import("next/cache")
      const s = await getSupabaseServerClient()
      const { data: customerDeliveries } = await s
        .from("deliveries")
        .select("id")
        .eq("customer_id", customerId)
        .eq("status", "delivered")
      const isFirstDelivery = customerDeliveries && customerDeliveries.length === 1
      await Promise.all([
        earnPoints(customerId, 100, "delivery", deliveryId, "배송 완료 포인트"),
        isFirstDelivery ? processReferralReward(customerId, deliveryId) : Promise.resolve(),
        createSettlementForDelivery(deliveryId),
      ])
      revalidatePath("/driver")
      revalidatePath(`/driver/delivery/${deliveryId}`)
      revalidatePath(`/customer/delivery/${deliveryId}`)
    })
  } else {
    revalidatePath("/driver")
    revalidatePath(`/driver/delivery/${deliveryId}`)
    revalidatePath(`/customer/delivery/${deliveryId}`)
  }

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
  revalidatePath("/driver/available")
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

/** ensure + get를 한 번에 처리 (왕복·auth.getUser 축소) */
export async function ensureAndGetDriverInfo() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다" }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return { error: "Service Role Key가 설정되지 않았습니다." }

  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  const svc = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)

  const { data: existing } = await svc.from("driver_info").select("id").eq("id", user.id).maybeSingle()
  if (!existing) {
    const { error: insertError } = await svc.from("driver_info").insert({
      id: user.id,
      vehicle_type: null,
      vehicle_number: null,
      license_number: null,
      is_available: false,
    })
    if (insertError) return { error: insertError.message }
  }

  const { data, error } = await svc.from("driver_info").select("*").eq("id", user.id).single()
  if (error) return { error: error.message }
  return { driverInfo: data }
}

export async function ensureDriverInfoForUser() {
  const res = await ensureAndGetDriverInfo()
  return res.error ? { error: res.error } : { success: true }
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

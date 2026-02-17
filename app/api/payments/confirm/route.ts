import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm"

function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_QUICKSUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) return null
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

async function confirmWithToss(paymentKey: string, orderId: string, amount: number) {
  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    return { error: "토스 결제 키가 설정되지 않았습니다." }
  }

  const encodedKey = Buffer.from(`${secretKey}:`).toString("base64")
  const response = await fetch(TOSS_CONFIRM_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: data?.message || "결제 승인에 실패했습니다." }
  }
  return { data }
}

async function updatePaymentStatus(params: {
  orderId: string
  status: "PAID" | "FAILED"
  paymentKey?: string
}) {
  const supabase = getServiceClient()
  if (!supabase) {
    return { error: "결제 업데이트에 실패했습니다." }
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount")
    .eq("order_id", params.orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment?.id) {
    return { error: "결제 정보를 찾을 수 없습니다." }
  }

  const approvedAt = params.status === "PAID" ? new Date().toISOString() : null

  await supabase
    .from("payments")
    .update({
      status: params.status,
      payment_key: params.paymentKey || null,
      pg_provider: "TOSS",
      pg_tid: params.paymentKey || null,
      approved_at: approvedAt,
      paid_at: approvedAt,
    })
    .eq("id", payment.id)

  if (params.status === "PAID") {
    await supabase.from("orders").update({ order_status: "PAID" }).eq("id", params.orderId)
    await supabase
      .from("settlements")
      .update({ payment_status: "PAID" })
      .eq("order_id", params.orderId)
  } else {
    await supabase
      .from("settlements")
      .update({ payment_status: "FAILED" })
      .eq("order_id", params.orderId)
  }

  return { payment }
}

async function getDeliveryId(orderId: string) {
  const supabase = getServiceClient()
  if (!supabase) return null
  const { data: order } = await supabase.from("orders").select("delivery_id").eq("id", orderId).maybeSingle()
  return order?.delivery_id || null
}

/** DB는 pickup_location(point)만 있음. (x,y)=(lng,lat) 형태로 파싱 */
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

async function notifyDriversAfterPayment(deliveryId: string) {
  console.log("[결제→기사] notifyDriversAfterPayment 시작", { deliveryId })
  const supabase = getServiceClient()
  if (!supabase) {
    console.warn("[결제→기사] getServiceClient null")
    return
  }
  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, pickup_location")
    .eq("id", deliveryId)
    .maybeSingle()
  const coords = delivery?.pickup_location ? parsePickupLatLng(delivery.pickup_location) : null
  if (!delivery?.id || !coords) {
    console.warn("[결제→기사] delivery 또는 좌표 없음", { deliveryId, delivery })
    return
  }
  console.log("[결제→기사] notifyDriversForDelivery 호출", { deliveryId, lat: coords.lat, lng: coords.lng })
  const { notifyDriversForDelivery } = await import("@/lib/actions/deliveries")
  await notifyDriversForDelivery(delivery.id, coords.lat, coords.lng)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const paymentKey = searchParams.get("paymentKey")
  const orderId = searchParams.get("orderId")
  const amount = Number(searchParams.get("amount") || 0)
  const isFailed = searchParams.get("failed") === "1"

  if (!orderId) {
    return NextResponse.json({ error: "주문 정보가 없습니다." }, { status: 400 })
  }

  if (isFailed || !paymentKey || !amount) {
    await updatePaymentStatus({ orderId, status: "FAILED" })
    const deliveryId = await getDeliveryId(orderId)
    const redirectUrl = deliveryId ? `/customer/delivery/${deliveryId}` : "/customer"
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  const confirmResult = await confirmWithToss(paymentKey, orderId, amount)
  if (confirmResult.error) {
    await updatePaymentStatus({ orderId, status: "FAILED", paymentKey })
    const deliveryId = await getDeliveryId(orderId)
    const redirectUrl = deliveryId ? `/customer/delivery/${deliveryId}` : "/customer"
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  await updatePaymentStatus({ orderId, status: "PAID", paymentKey })
  const deliveryId = await getDeliveryId(orderId)
  if (deliveryId) {
    console.log("[결제확인] 기사 알림 트리거", { deliveryId })
    notifyDriversAfterPayment(deliveryId)
      .then(() => console.log("[결제확인] 기사 알림 완료", { deliveryId }))
      .catch((e) => console.error("[결제확인] 기사 알림 실패:", e))
  }
  const redirectUrl = deliveryId ? `/customer/delivery/${deliveryId}` : "/customer"
  return NextResponse.redirect(new URL(redirectUrl, request.url))
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const paymentKey = body?.paymentKey as string | undefined
  const orderId = body?.orderId as string | undefined
  const amount = Number(body?.amount || 0)

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: "결제 정보가 부족합니다." }, { status: 400 })
  }

  const confirmResult = await confirmWithToss(paymentKey, orderId, amount)
  if (confirmResult.error) {
    await updatePaymentStatus({ orderId, status: "FAILED", paymentKey })
    return NextResponse.json({ error: confirmResult.error }, { status: 400 })
  }

  await updatePaymentStatus({ orderId, status: "PAID", paymentKey })
  const deliveryId = await getDeliveryId(orderId)
  if (deliveryId) {
    console.log("[결제확인-POST] 기사 알림 트리거", { deliveryId })
    notifyDriversAfterPayment(deliveryId)
      .then(() => console.log("[결제확인-POST] 기사 알림 완료", { deliveryId }))
      .catch((e) => console.error("[결제확인-POST] 기사 알림 실패:", e))
  }
  return NextResponse.json({ success: true })
}

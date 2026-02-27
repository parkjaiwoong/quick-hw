import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getBillingKeyForPayment } from "@/lib/actions/billing"

const TOSS_BILLING_PAY_URL = "https://api.tosspayments.com/v1/billing"

function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_QUICKSUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) return null
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

/** DB pickup_location(point) 파싱: (lng,lat) 형태 */
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

/** 결제 완료 후 기사에게 FCM 알림 전송 */
async function notifyDriversAfterPayment(deliveryId: string) {
  console.log("[빌링결제→기사] notifyDriversAfterPayment 시작", { deliveryId })
  const supabase = getServiceClient()
  if (!supabase) {
    console.warn("[빌링결제→기사] getServiceClient null")
    return
  }
  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, pickup_location")
    .eq("id", deliveryId)
    .maybeSingle()
  const coords = delivery?.pickup_location ? parsePickupLatLng(delivery.pickup_location) : null
  if (!delivery?.id || !coords) {
    console.warn("[빌링결제→기사] delivery 또는 좌표 없음", { deliveryId, delivery })
    return
  }
  console.log("[빌링결제→기사] notifyDriversForDelivery 호출", { deliveryId, lat: coords.lat, lng: coords.lng })
  const { notifyDriversForDelivery } = await import("@/lib/actions/deliveries")
  await notifyDriversForDelivery(delivery.id, coords.lat, coords.lng)
}

async function updatePaymentStatus(params: {
  orderId: string
  status: "PAID" | "FAILED"
  paymentKey?: string
}) {
  const supabase = getServiceClient()
  if (!supabase) return { error: "결제 업데이트에 실패했습니다." }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount")
    .eq("order_id", params.orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment?.id) return { error: "결제 정보를 찾을 수 없습니다." }

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
    await supabase.from("settlements").update({ payment_status: "PAID" }).eq("order_id", params.orderId)
  } else {
    await supabase.from("settlements").update({ payment_status: "FAILED" }).eq("order_id", params.orderId)
  }

  return { payment }
}

/** 등록된 빌링키로 결제 승인 요청 (토스 카드 자동결제 승인 API) */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const orderId = body?.orderId as string | undefined

  if (!orderId) {
    return NextResponse.json({ error: "주문 ID가 필요합니다." }, { status: 400 })
  }

  const { billingKey, customerKey } = await getBillingKeyForPayment(user.id)
  if (!billingKey || !customerKey) {
    return NextResponse.json({ error: "등록된 카드가 없습니다. 계좌/카드 연동에서 먼저 등록해 주세요." }, { status: 400 })
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, order_amount, customer_adjusted_amount, payment_method, delivery_id")
    .eq("id", orderId)
    .maybeSingle()

  if (!order || order.customer_id !== user.id) {
    return NextResponse.json({ error: "주문 정보를 찾을 수 없습니다." }, { status: 404 })
  }

  if (order.payment_method && order.payment_method !== "card") {
    return NextResponse.json({ error: "카드 결제만 지원합니다." }, { status: 400 })
  }

  const amount = Number(order.customer_adjusted_amount ?? order.order_amount ?? 0)
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "결제 금액이 올바르지 않습니다." }, { status: 400 })
  }

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, status, amount")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingPayment?.status === "PAID") {
    return NextResponse.json({ error: "이미 결제가 완료되었습니다." }, { status: 400 })
  }

  if (!existingPayment?.id) {
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        delivery_id: order.delivery_id,
        customer_id: user.id,
        amount,
        payment_method: "card",
        status: "READY",
        pg_provider: "TOSS",
        requested_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    if (error || !payment) {
      return NextResponse.json({ error: error?.message || "결제 생성에 실패했습니다." }, { status: 500 })
    }
  }

  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: "토스 결제 키가 설정되지 않았습니다." }, { status: 500 })
  }

  const encodedKey = Buffer.from(`${secretKey}:`).toString("base64")
  const payUrl = `${TOSS_BILLING_PAY_URL}/${encodeURIComponent(billingKey)}`
  const res = await fetch(payUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerKey,
      amount,
      orderId: order.id,
      orderName: "퀵서비스 주문",
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    paymentKey?: string
    orderId?: string
    totalAmount?: number
    status?: string
    code?: string
    message?: string
  }

  if (!res.ok) {
    await updatePaymentStatus({ orderId: order.id, status: "FAILED" })
    return NextResponse.json(
      { error: data?.message || data?.code || "등록 카드 결제에 실패했습니다." },
      { status: 400 }
    )
  }

  const paymentKey = data.paymentKey
  const approvedAmount = Number(data.totalAmount ?? amount)
  if (!paymentKey || data.status !== "DONE") {
    await updatePaymentStatus({ orderId: order.id, status: "FAILED", paymentKey: paymentKey || undefined })
    return NextResponse.json({ error: "결제 승인 결과가 올바르지 않습니다." }, { status: 400 })
  }

  const updateResult = await updatePaymentStatus({
    orderId: order.id,
    status: "PAID",
    paymentKey,
  })
  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error }, { status: 500 })
  }

  const deliveryId = order.delivery_id ?? ""

  // 결제 완료 후 기사에게 FCM 알림 전송 (비동기 — 응답 지연 없음)
  if (deliveryId) {
    console.log("[빌링결제] 기사 알림 트리거", { deliveryId })
    notifyDriversAfterPayment(deliveryId)
      .then(() => console.log("[빌링결제] 기사 알림 완료", { deliveryId }))
      .catch((e) => console.error("[빌링결제] 기사 알림 실패:", e))
  }

  return NextResponse.json({
    success: true,
    deliveryId,
    amount: approvedAmount,
  })
}

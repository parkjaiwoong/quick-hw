import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

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
  const amount = Number(body?.amount || 0)

  if (!orderId) {
    return NextResponse.json({ error: "주문 ID가 필요합니다." }, { status: 400 })
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

  const expectedAmount = Number(order.customer_adjusted_amount ?? order.order_amount ?? amount)
  if (!expectedAmount || (amount && amount !== expectedAmount)) {
    return NextResponse.json({ error: "결제 금액이 일치하지 않습니다." }, { status: 400 })
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

  let paymentId = existingPayment?.id
  if (!existingPayment?.id) {
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        delivery_id: order.delivery_id,
        customer_id: user.id,
        amount: expectedAmount,
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
    paymentId = payment.id
  } else {
    await supabase
      .from("payments")
      .update({
        status: "READY",
        amount: expectedAmount,
        pg_provider: "TOSS",
        requested_at: new Date().toISOString(),
      })
      .eq("id", existingPayment.id)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle()

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
  if (!clientKey) {
    return NextResponse.json({ error: "결제 키가 설정되지 않았습니다." }, { status: 500 })
  }

  const origin = new URL(request.url).origin

  return NextResponse.json({
    paymentId,
    orderId: order.id,
    amount: expectedAmount,
    orderName: "퀵서비스 주문",
    customerName: profile?.full_name || profile?.email || "고객",
    successUrl: `${origin}/payments/success`,
    failUrl: `${origin}/payments/fail`,
    clientKey,
  })
}

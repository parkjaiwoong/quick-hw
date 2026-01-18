"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { PaymentMethod } from "@/lib/types/database"

type ServiceClient = Awaited<ReturnType<typeof getSupabaseServerClient>>

async function getServiceClient(): Promise<ServiceClient | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return null

  const { createClient } = await import("@supabase/supabase-js")
  return createClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

function normalizePaymentMethod(method?: string | null): PaymentMethod {
  if (method === "bank_transfer") return "bank_transfer"
  if (method === "cash") return "cash"
  return "card"
}

function derivePaymentStatus(method: PaymentMethod) {
  return method === "cash" ? "PENDING" : "PAID"
}

export async function createOrderAndPaymentForDelivery(params: {
  deliveryId: string
  customerId: string
  amount: number
  paymentMethod?: string | null
  customerAdjustedAmount?: number | null
}) {
  const supabase = await getSupabaseServerClient()
  const method = normalizePaymentMethod(params.paymentMethod)
  const paymentStatus = derivePaymentStatus(method)

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id, order_status")
    .eq("delivery_id", params.deliveryId)
    .maybeSingle()

  if (existingOrder?.id) {
    return { orderId: existingOrder.id, paymentStatus }
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: params.customerId,
      delivery_id: params.deliveryId,
      order_amount: params.amount,
      customer_adjusted_amount: params.customerAdjustedAmount ?? null,
      payment_method: method,
      order_status: "REQUEST",
    })
    .select("id")
    .single()

  if (orderError || !order) {
    return { error: orderError?.message || "주문 생성에 실패했습니다." }
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      delivery_id: params.deliveryId,
      customer_id: params.customerId,
      amount: params.amount,
      payment_method: method,
      status: paymentStatus,
      paid_at: paymentStatus === "PAID" ? new Date().toISOString() : null,
      requested_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (paymentError || !payment) {
    return { error: paymentError?.message || "결제 기록 생성에 실패했습니다." }
  }

  if (paymentStatus === "PAID") {
    await supabase.from("orders").update({ order_status: "PAID" }).eq("id", order.id)
  }

  return { orderId: order.id, paymentId: payment.id, paymentStatus }
}

export async function getOrderPaymentSummaryByDelivery(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_amount, customer_adjusted_amount, payment_method, order_status")
    .eq("delivery_id", deliveryId)
    .maybeSingle()

  if (!order) {
    return { order: null, payment: null }
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("status, amount, payment_method")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return { order, payment }
}

export async function syncOrderStatusForDelivery(deliveryId: string, status: string) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  const { data: order } = await supabase.from("orders").select("id, order_status").eq("delivery_id", deliveryId).maybeSingle()
  if (!order) return { success: false }

  const nextStatusMap: Record<string, string> = {
    accepted: "ASSIGNED",
    picked_up: "PICKED_UP",
    in_transit: "PICKED_UP",
    delivered: "DELIVERED",
    cancelled: "CANCELED",
  }

  const nextStatus = nextStatusMap[status]
  if (!nextStatus) {
    return { success: false }
  }

  await supabase.from("orders").update({ order_status: nextStatus }).eq("id", order.id)
  return { success: true }
}

export async function cancelPaymentForDelivery(deliveryId: string) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("delivery_id", deliveryId)
    .maybeSingle()

  if (!order) return { success: false }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment?.id) return { success: false }

  await supabase
    .from("payments")
    .update({ status: "CANCELED", canceled_at: new Date().toISOString() })
    .eq("id", payment.id)

  await supabase.from("orders").update({ order_status: "CANCELED" }).eq("id", order.id)
  return { success: true }
}

export async function refundPaymentForDelivery(deliveryId: string) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("delivery_id", deliveryId)
    .maybeSingle()

  if (!order) return { success: false }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment?.id) return { success: false }

  await supabase
    .from("payments")
    .update({
      status: "REFUNDED",
      refunded_at: new Date().toISOString(),
      refunded_amount: payment.amount,
    })
    .eq("id", payment.id)

  await supabase.from("orders").update({ order_status: "CANCELED" }).eq("id", order.id)
  return { success: true }
}

export async function ensureDriverWallet(driverId: string) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  const { data: existing } = await supabase.from("driver_wallet").select("id").eq("driver_id", driverId).maybeSingle()
  if (existing?.id) {
    return { walletId: existing.id }
  }

  const { data: platform } = await supabase.from("platform_settings").select("*").maybeSingle()
  const initialBalance = Number(platform?.driver_wallet_initial_balance ?? 0)
  const minPayout = Number(platform?.driver_wallet_min_payout ?? 0)

  const { data: wallet, error } = await supabase
    .from("driver_wallet")
    .insert({
      driver_id: driverId,
      total_balance: initialBalance,
      available_balance: initialBalance,
      pending_balance: 0,
      min_payout_amount: minPayout,
    })
    .select("id")
    .single()

  if (error || !wallet) {
    return { error: error?.message || "지갑 생성 실패" }
  }

  return { walletId: wallet.id }
}

export async function createSettlementForDelivery(deliveryId: string) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, driver_id, delivered_at, driver_fee, platform_fee, total_fee")
    .eq("id", deliveryId)
    .maybeSingle()

  if (!delivery?.driver_id) {
    return { error: "배송원 정보가 없습니다." }
  }

  const { data: existing } = await supabase
    .from("settlements")
    .select("id")
    .eq("delivery_id", deliveryId)
    .maybeSingle()

  if (existing?.id) {
    return { settlementId: existing.id }
  }

  const { data: order } = await supabase.from("orders").select("id").eq("delivery_id", deliveryId).maybeSingle()
  const { data: payment } = order?.id
    ? await supabase
        .from("payments")
        .select("id, status, payment_method")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const settlementAmount = Number(delivery.driver_fee ?? delivery.total_fee ?? 0)
  const deliveredDate = delivery.delivered_at
    ? new Date(delivery.delivered_at).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0]

  const { data: settlement, error } = await supabase
    .from("settlements")
    .insert({
      driver_id: delivery.driver_id,
      delivery_id: delivery.id,
      order_id: order?.id ?? null,
      payment_id: payment?.id ?? null,
      settlement_status: "PENDING",
      settlement_amount: settlementAmount,
      status: "pending",
      settlement_period_start: deliveredDate,
      settlement_period_end: deliveredDate,
      total_deliveries: 1,
      total_earnings: settlementAmount,
      platform_fee_total: Number(delivery.platform_fee ?? 0),
      net_earnings: settlementAmount,
    })
    .select("id")
    .single()

  if (error || !settlement) {
    return { error: error?.message || "정산 생성 실패" }
  }

  await ensureDriverWallet(delivery.driver_id)

  if (payment?.id && payment.payment_method === "cash" && payment.status === "PENDING") {
    await supabase
      .from("payments")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .eq("id", payment.id)
  }

  await supabase.rpc("increment_driver_wallet_pending", {
    p_driver_id: delivery.driver_id,
    p_amount: settlementAmount,
  })

  return { settlementId: settlement.id }
}

export async function excludeSettlementForDelivery(deliveryId: string, reason: string) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  await supabase
    .from("settlements")
    .update({
      settlement_status: "EXCLUDED",
      status: "cancelled",
      excluded_reason: reason,
    })
    .eq("delivery_id", deliveryId)

  return { success: true }
}

export async function getDriverWalletSummary(driverId: string) {
  const supabase = await getSupabaseServerClient()

  const { data: wallet } = await supabase.from("driver_wallet").select("*").eq("driver_id", driverId).maybeSingle()
  const { data: payouts } = await supabase
    .from("payout_requests")
    .select("requested_amount, status")
    .eq("driver_id", driverId)
    .order("requested_at", { ascending: false })

  const pendingPayoutAmount =
    payouts?.filter((p) => p.status === "pending" || p.status === "approved").reduce((sum, p) => sum + Number(p.requested_amount || 0), 0) || 0

  return { wallet, payouts: payouts || [], pendingPayoutAmount }
}

export async function requestPayout(driverId: string, amount: number) {
  const supabase = await getSupabaseServerClient()

  const { data: wallet } = await supabase.from("driver_wallet").select("*").eq("driver_id", driverId).maybeSingle()
  if (!wallet) {
    return { error: "지갑 정보를 찾을 수 없습니다." }
  }

  const { data: existingRequest } = await supabase
    .from("payout_requests")
    .select("id, status")
    .eq("driver_id", driverId)
    .in("status", ["pending", "approved"])
    .maybeSingle()

  if (existingRequest?.id) {
    return { error: "대기 중인 출금 요청이 있어 추가 요청이 불가합니다." }
  }

  if (amount < Number(wallet.min_payout_amount)) {
    return { error: `최소 출금 금액은 ${Number(wallet.min_payout_amount).toLocaleString()}원입니다.` }
  }

  if (amount > Number(wallet.available_balance)) {
    return { error: "출금 가능 금액이 부족합니다." }
  }

  const { data: driverInfo } = await supabase.from("driver_info").select("bank_account, bank_name").eq("id", driverId).maybeSingle()

  const { error } = await supabase.from("payout_requests").insert({
    driver_id: driverId,
    requested_amount: amount,
    status: "pending",
    bank_account: driverInfo?.bank_account ?? null,
    bank_name: driverInfo?.bank_name ?? null,
  })

  if (error) {
    return { error: error.message }
  }

  await supabase
    .from("driver_wallet")
    .update({
      available_balance: Number(wallet.available_balance) - amount,
    })
    .eq("driver_id", driverId)

  revalidatePath("/driver/wallet")
  return { success: true }
}

export async function getAdminPayoutRequests() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("payout_requests")
    .select(
      `
      *,
      driver:profiles!payout_requests_driver_id_fkey(full_name, email, phone)
    `,
    )
    .order("requested_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { payouts: data }
}

export async function markPayoutPaid(payoutId: string) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  const { data: payout } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("id", payoutId)
    .maybeSingle()

  if (!payout) {
    return { error: "출금 요청을 찾을 수 없습니다." }
  }

  await supabase
    .from("payout_requests")
    .update({ status: "paid", processed_at: new Date().toISOString() })
    .eq("id", payoutId)

  const { data: settlements } = await supabase
    .from("settlements")
    .select("id, settlement_amount")
    .eq("driver_id", payout.driver_id)
    .eq("settlement_status", "CONFIRMED")
    .is("payout_request_id", null)
    .order("created_at", { ascending: true })

  let remaining = Number(payout.requested_amount)
  for (const settlement of settlements || []) {
    if (remaining <= 0) break
    remaining -= Number(settlement.settlement_amount || 0)
    await supabase
      .from("settlements")
      .update({ settlement_status: "PAID_OUT", payout_request_id: payout.id, status: "completed" })
      .eq("id", settlement.id)
  }

  revalidatePath("/admin/payouts")
  return { success: true }
}

export async function confirmSettlement(settlementId: string) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  const { data: settlement } = await supabase
    .from("settlements")
    .select("id, driver_id, settlement_amount")
    .eq("id", settlementId)
    .maybeSingle()

  if (!settlement?.driver_id) {
    return { error: "정산 정보를 찾을 수 없습니다." }
  }

  await supabase
    .from("settlements")
    .update({ settlement_status: "CONFIRMED", status: "processing" })
    .eq("id", settlementId)

  await ensureDriverWallet(settlement.driver_id)

  await supabase.rpc("move_driver_wallet_pending_to_available", {
    p_driver_id: settlement.driver_id,
    p_amount: Number(settlement.settlement_amount || 0),
  })

  revalidatePath("/admin/settlements")
  revalidatePath("/driver/wallet")
  return { success: true }
}

export async function getAllPayments() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      *,
      customer:profiles!payments_customer_id_fkey(full_name, email, phone)
    `,
    )
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { payments: data }
}

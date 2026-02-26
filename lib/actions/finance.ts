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
  if (method === "cash") return "PENDING"
  return "READY"
}

const TOSS_CANCEL_URL = "https://api.tosspayments.com/v1/payments"

/** 토스페이먼츠 결제 취소 API 호출 (전액 취소 = 카드 취소/환불 동일) */
async function cancelTossPayment(paymentKey: string, cancelReason: string): Promise<{ error?: string }> {
  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) return { error: "토스 시크릿 키가 설정되지 않았습니다." }
  const encodedKey = Buffer.from(`${secretKey}:`).toString("base64")
  const res = await fetch(`${TOSS_CANCEL_URL}/${encodeURIComponent(paymentKey)}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cancelReason }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { error: (data as { message?: string }).message || "토스 결제 취소에 실패했습니다." }
  return {}
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

  const service = await getServiceClient()
  const writeClient = service ?? supabase

  const { data: order, error: orderError } = await writeClient
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

  const { data: payment, error: paymentError } = await writeClient
    .from("payments")
    .insert({
      order_id: order.id,
      delivery_id: params.deliveryId,
      customer_id: params.customerId,
      amount: params.amount,
      payment_method: method,
      status: paymentStatus,
      pg_provider: method === "card" ? "TOSS" : null,
      paid_at: null,
      approved_at: null,
      requested_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (paymentError || !payment) {
    return { error: paymentError?.message || "결제 기록 생성에 실패했습니다." }
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

  if (!order) return { success: true }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, status, payment_key, pg_provider")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment?.id) return { success: true }

  if (payment.pg_provider === "TOSS" && payment.status === "PAID" && payment.payment_key) {
    const tossErr = await cancelTossPayment(payment.payment_key, "고객 변심 (배송 전 취소)")
    if (tossErr.error) return { success: false, error: tossErr.error }
  }

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
    .select("id, amount, payment_key, pg_provider, status")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment?.id) return { success: false }

  if (payment.pg_provider === "TOSS" && payment.status === "PAID" && payment.payment_key) {
    const tossErr = await cancelTossPayment(payment.payment_key, "고객 변심 (배송 후 환불)")
    if (tossErr.error) return { success: false, error: tossErr.error }
  }

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
    .select("id, driver_id, delivered_at, driver_fee, platform_fee, total_fee, referring_rider_id")
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
  const shouldReady = payment?.status === "PAID"

  const { data: settlement, error } = await supabase
    .from("settlements")
    .insert({
      driver_id: delivery.driver_id,
      delivery_id: delivery.id,
      order_id: order?.id ?? null,
      payment_id: payment?.id ?? null,
      payment_status: payment?.status ?? null,
      settlement_status: shouldReady ? "READY" : "PENDING",
      settlement_amount: settlementAmount,
      status: "pending",
      settlement_period_start: deliveredDate,
      settlement_period_end: deliveredDate,
      total_deliveries: 1,
      total_earnings: settlementAmount,
      platform_fee_total: Number(delivery.platform_fee ?? 0),
      net_earnings: settlementAmount,
      confirmed_at: null,
    })
    .select("id")
    .single()

  if (error || !settlement) {
    return { error: error?.message || "정산 생성 실패" }
  }

  await ensureDriverWallet(delivery.driver_id)

  if (
    payment?.id &&
    payment.payment_method === "cash" &&
    (payment.status === "PENDING" || payment.status === "READY")
  ) {
    await supabase
      .from("payments")
      .update({ status: "PAID", paid_at: new Date().toISOString(), approved_at: new Date().toISOString() })
      .eq("id", payment.id)
    await supabase.from("settlements").update({ payment_status: "PAID" }).eq("id", settlement.id)
  }

  await supabase.rpc("increment_driver_wallet_pending", {
    p_driver_id: delivery.driver_id,
    p_amount: settlementAmount,
  })

  if (shouldReady) {
    // TODO: apply D+N waiting period before moving to READY
    await supabase.rpc("move_driver_wallet_pending_to_available", {
      p_driver_id: delivery.driver_id,
      p_amount: settlementAmount,
    })
  }

  // 귀속 기사 수수료: referring_rider_id 가 있으면 해당 기사에게 리워드 기록 및 지갑 적립
  const referringRiderId = delivery.referring_rider_id ?? null
  if (referringRiderId && typeof referringRiderId === "string") {
    await addRiderReferralReward({
      supabase,
      deliveryId: delivery.id,
      orderId: order?.id ?? null,
      referringRiderId,
      totalFee: Number(delivery.total_fee ?? 0),
      shouldReady,
    })
  }

  return { settlementId: settlement.id }
}

/** 귀속 기사 수수료: rider_reward_history 기록 + 해당 기사 지갑에 적립 */
async function addRiderReferralReward(params: {
  supabase: ServiceClient
  deliveryId: string
  orderId: string | null
  referringRiderId: string
  totalFee: number
  shouldReady: boolean
}) {
  const { supabase, deliveryId, orderId, referringRiderId, totalFee, shouldReady } = params
  if (totalFee <= 0) return

  const { data: masterPolicy } = await supabase
    .from("reward_policy_master")
    .select("rider_reward_rate")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let rate = Number(masterPolicy?.rider_reward_rate ?? 0.05)
  const { data: overridePolicy } = await supabase
    .from("rider_reward_policy")
    .select("rider_reward_rate")
    .eq("rider_id", referringRiderId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (overridePolicy != null && Number.isFinite(Number(overridePolicy.rider_reward_rate))) {
    rate = Number(overridePolicy.rider_reward_rate)
  }

  const rewardAmount = Math.round(totalFee * rate)
  if (rewardAmount <= 0) return

  const { error: histError } = await supabase.from("rider_reward_history").insert({
    delivery_id: deliveryId,
    order_id: orderId,
    rider_id: referringRiderId,
    reward_rate: rate,
    reward_amount: rewardAmount,
    status: "pending",
  })
  if (histError) {
    console.warn("rider_reward_history insert failed (table may not exist):", histError.message)
    return
  }

  await ensureDriverWallet(referringRiderId)
  await supabase.rpc("increment_driver_wallet_pending", {
    p_driver_id: referringRiderId,
    p_amount: rewardAmount,
  })
  if (shouldReady) {
    await supabase.rpc("move_driver_wallet_pending_to_available", {
      p_driver_id: referringRiderId,
      p_amount: rewardAmount,
    })
  }
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
    payouts
      ?.filter((p) => p.status === "requested" || p.status === "on_hold" || p.status === "approved")
      .reduce((sum, p) => sum + Number(p.requested_amount || 0), 0) || 0

  return { wallet, payouts: payouts || [], pendingPayoutAmount }
}

/** 기사 정산 페이지에서 호출: 폼 데이터만 받고, 액션 내부에서 인증 후 출금 요청 (클로저 미사용으로 서버 오류 방지) */
export async function requestPayoutFromDriver(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "로그인이 필요합니다." }
  }
  const amount = Number(formData.get("amount") || 0)
  const bankName = String(formData.get("bank_name") || "").trim()
  const accountNo = String(formData.get("account_no") || "").trim()
  if (bankName || accountNo) {
    await supabase
      .from("driver_info")
      .update({ bank_name: bankName || null, bank_account: accountNo || null })
      .eq("id", user.id)
  }
  const result = await requestPayout(user.id, amount)
  if (result?.error) return result
  revalidatePath("/driver/settlements")
  return result
}

export async function requestPayout(driverId: string, amount: number) {
  const supabase = await getSupabaseServerClient()

  const { data: wallet } = await supabase.from("driver_wallet").select("*").eq("driver_id", driverId).maybeSingle()
  if (!wallet) {
    return { error: "지갑 정보를 찾을 수 없습니다." }
  }

  const { data: lockedSettlements } = await supabase
    .from("settlements")
    .select("id")
    .eq("driver_id", driverId)
    .eq("settlement_status", "LOCKED")
    .limit(1)
  if (lockedSettlements && lockedSettlements.length > 0) {
    return { error: "분쟁 건으로 출금 요청이 제한됩니다." }
  }

  const { data: readySettlements } = await supabase
    .from("settlements")
    .select("id")
    .eq("driver_id", driverId)
    .eq("settlement_status", "READY")
    .eq("payment_status", "PAID")
    .limit(1)
  if (!readySettlements || readySettlements.length === 0) {
    return { error: "출금 가능한 정산이 없습니다." }
  }

  const { data: existingRequest } = await supabase
    .from("payout_requests")
    .select("id, status")
    .eq("driver_id", driverId)
    .in("status", ["requested", "on_hold", "approved"])
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
    status: "requested",
    bank_account: driverInfo?.bank_account ?? null,
    bank_name: driverInfo?.bank_name ?? null,
    settlement_status: "READY",
    settlement_locked: false,
    payout_status: "NONE",
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

/** 관리자 대시보드용 알림/주요 지표 (정산 대기, 출금 대기 건수·금액) */
export async function getAdminAlertCounts() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다." }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "관리자 권한이 필요합니다." }

  const [{ count: pendingSettlementCount }, { data: pendingPayouts }] = await Promise.all([
    supabase.from("settlements").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("payout_requests")
      .select("id, requested_amount")
      .in("status", ["requested", "on_hold"]),
  ])

  const pendingPayoutCount = pendingPayouts?.length ?? 0
  const pendingPayoutAmount = pendingPayouts?.reduce((sum, p) => sum + Number(p.requested_amount || 0), 0) ?? 0

  return {
    pendingSettlementCount: pendingSettlementCount ?? 0,
    pendingPayoutCount,
    pendingPayoutAmount,
  }
}

async function requireAdminClient() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "인증이 필요합니다." }
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") {
    return { error: "관리자 권한이 필요합니다." }
  }
  const serviceClient = await getServiceClient()
  return { supabase: serviceClient || supabase, adminId: user.id }
}

async function logPayoutStatusChange(params: {
  payoutId: string
  previousStatus: string | null
  nextStatus: string
  adminId: string
  reason?: string
}) {
  const serviceClient = await getServiceClient()
  if (!serviceClient) return
  await serviceClient.from("payout_request_logs").insert({
    payout_request_id: params.payoutId,
    previous_status: params.previousStatus,
    next_status: params.nextStatus,
    admin_id: params.adminId,
    reason: params.reason || null,
  })
}

export async function approvePayout(payoutId: string) {
  const admin = await requireAdminClient()
  if ("error" in admin) {
    return { error: admin.error }
  }

  const supabase = admin.supabase
  const { data: payout } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("id", payoutId)
    .maybeSingle()

  if (!payout) {
    return { error: "출금 요청을 찾을 수 없습니다." }
  }

  if (payout.status !== "requested") {
    return { error: "요청 상태에서만 승인할 수 있습니다." }
  }
  if (payout.settlement_status !== "READY") {
    return { error: "READY 상태의 정산만 승인할 수 있습니다." }
  }
  if (payout.settlement_locked) {
    return { error: "정산이 잠금 상태입니다." }
  }

  const { data: locked } = await supabase
    .from("settlements")
    .select("id")
    .eq("driver_id", payout.driver_id)
    .eq("settlement_status", "LOCKED")
    .limit(1)
  if (locked && locked.length > 0) {
    return { error: "LOCKED 정산이 포함되어 있어 승인할 수 없습니다." }
  }

  const { data: confirmedSettlements } = await supabase
    .from("settlements")
    .select("settlement_amount")
    .eq("driver_id", payout.driver_id)
    .eq("settlement_status", "CONFIRMED")
    .is("payout_request_id", null)

  const confirmedAmount =
    confirmedSettlements?.reduce((sum, s) => sum + Number(s.settlement_amount || 0), 0) || 0
  if (confirmedAmount < Number(payout.requested_amount || 0)) {
    return { error: "CONFIRMED 정산 금액이 부족하여 승인할 수 없습니다." }
  }

  const { data: settlements } = await supabase
    .from("settlements")
    .select("id, settlement_amount, settlement_status, settlement_locked, payment_status")
    .eq("driver_id", payout.driver_id)
    .eq("settlement_status", "READY")
    .eq("payment_status", "PAID")
    .order("created_at", { ascending: true })

  let remaining = Number(payout.requested_amount)
  const targetSettlementIds: string[] = []
  for (const settlement of settlements || []) {
    if (remaining <= 0) break
    if (settlement.settlement_locked) continue
    remaining -= Number(settlement.settlement_amount || 0)
    targetSettlementIds.push(settlement.id)
  }

  if (remaining > 0) {
    return { error: "READY 정산 금액이 부족하여 승인할 수 없습니다." }
  }

  await supabase
    .from("payout_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      settlement_status: "CONFIRMED",
      payout_status: "WAITING",
    })
    .eq("id", payoutId)

  if (targetSettlementIds.length > 0) {
    await supabase
      .from("settlements")
      .update({ settlement_status: "CONFIRMED", payout_request_id: payout.id })
      .in("id", targetSettlementIds)
  }

  await logPayoutStatusChange({
    payoutId,
    previousStatus: payout.status,
    nextStatus: "approved",
    adminId: admin.adminId,
  })

  revalidatePath("/admin/payouts")
  revalidatePath("/driver/wallet")
  return { success: true }
}

async function logPayoutTransfer(params: {
  payoutId: string
  transferMethod: "MANUAL" | "AUTO"
  executedBy: "ADMIN" | "SYSTEM"
  resultStatus: "TRANSFERRED" | "FAILED" | "CANCELED"
  reason?: string
}) {
  const serviceClient = await getServiceClient()
  if (!serviceClient) return
  await serviceClient.from("payout_transfer_logs").insert({
    payout_request_id: params.payoutId,
    transfer_method: params.transferMethod,
    executed_by: params.executedBy,
    result_status: params.resultStatus,
    reason: params.reason || null,
  })
}

export async function transferPayout(payoutId: string, transferMethod: "MANUAL" | "AUTO" = "MANUAL") {
  const admin = await requireAdminClient()
  if ("error" in admin) {
    return { error: admin.error }
  }

  const supabase = admin.supabase
  const { data: payout } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("id", payoutId)
    .maybeSingle()

  if (!payout?.id) {
    return { error: "출금 요청을 찾을 수 없습니다." }
  }
  if (payout.status !== "approved" && payout.status !== "failed") {
    return { error: "승인된 출금 요청만 집행할 수 있습니다." }
  }

  const { data: locked } = await supabase
    .from("settlements")
    .select("id")
    .eq("driver_id", payout.driver_id)
    .eq("settlement_status", "LOCKED")
    .limit(1)
  if (locked && locked.length > 0) {
    return { error: "LOCKED 정산이 포함되어 있어 집행할 수 없습니다." }
  }

  await supabase
    .from("payout_requests")
    .update({
      status: "transferred",
      transferred_at: new Date().toISOString(),
      transfer_method: transferMethod,
      processed_at: new Date().toISOString(),
      payout_status: "PAID_OUT",
    })
    .eq("id", payoutId)

  let { data: settlements } = await supabase
    .from("settlements")
    .select("id, settlement_amount")
    .eq("payout_request_id", payout.id)
    .order("created_at", { ascending: true })

  if (!settlements || settlements.length === 0) {
    const fallback = await supabase
      .from("settlements")
      .select("id, settlement_amount")
      .eq("driver_id", payout.driver_id)
      .eq("settlement_status", "CONFIRMED")
      .is("payout_request_id", null)
      .order("created_at", { ascending: true })
    settlements = fallback.data || []
  }

  for (const settlement of settlements || []) {
    await supabase
      .from("settlements")
      .update({ settlement_status: "PAID_OUT", status: "completed" })
      .eq("id", settlement.id)
  }

  await logPayoutTransfer({
    payoutId,
    transferMethod,
    executedBy: "ADMIN",
    resultStatus: "TRANSFERRED",
  })

  revalidatePath("/admin/payouts")
  revalidatePath("/driver/wallet")
  return { success: true }
}

export async function holdPayout(payoutId: string, reason: string) {
  const admin = await requireAdminClient()
  if ("error" in admin) {
    return { error: admin.error }
  }
  if (!reason?.trim()) {
    return { error: "보류 사유가 필요합니다." }
  }
  const supabase = admin.supabase
  const { data: payout } = await supabase
    .from("payout_requests")
    .select("id, status")
    .eq("id", payoutId)
    .maybeSingle()

  if (!payout?.id) {
    return { error: "출금 요청을 찾을 수 없습니다." }
  }

  await supabase
    .from("payout_requests")
    .update({ status: "on_hold", notes: reason, settlement_status: "HOLD", settlement_locked: true })
    .eq("id", payoutId)

  await logPayoutStatusChange({
    payoutId,
    previousStatus: payout.status,
    nextStatus: "on_hold",
    adminId: admin.adminId,
    reason,
  })

  revalidatePath("/admin/payouts")
  revalidatePath("/driver/wallet")
  return { success: true }
}

export async function rejectPayout(payoutId: string, reason: string) {
  const admin = await requireAdminClient()
  if ("error" in admin) {
    return { error: admin.error }
  }
  if (!reason?.trim()) {
    return { error: "반려 사유가 필요합니다." }
  }
  const supabase = admin.supabase
  const { data: payout } = await supabase
    .from("payout_requests")
    .select("id, status, driver_id, requested_amount")
    .eq("id", payoutId)
    .maybeSingle()

  if (!payout?.id) {
    return { error: "출금 요청을 찾을 수 없습니다." }
  }

  await supabase
    .from("payout_requests")
    .update({
      status: "rejected",
      notes: reason,
      processed_at: new Date().toISOString(),
      settlement_status: "READY",
      settlement_locked: false,
    })
    .eq("id", payoutId)

  const { data: wallet } = await supabase
    .from("driver_wallet")
    .select("available_balance")
    .eq("driver_id", payout.driver_id)
    .maybeSingle()

  if (wallet) {
    await supabase
      .from("driver_wallet")
      .update({
        available_balance: Number(wallet.available_balance || 0) + Number(payout.requested_amount || 0),
      })
      .eq("driver_id", payout.driver_id)
  }

  await logPayoutStatusChange({
    payoutId,
    previousStatus: payout.status,
    nextStatus: "rejected",
    adminId: admin.adminId,
    reason,
  })

  revalidatePath("/admin/payouts")
  revalidatePath("/driver/wallet")
  return { success: true }
}

export async function markPayoutPaid(payoutId: string) {
  return transferPayout(payoutId, "MANUAL")
}

export async function confirmSettlement(settlementId: string) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  const { data: settlement } = await supabase
    .from("settlements")
    .select("id, driver_id, settlement_amount, payment_id, order_id, payment_status")
    .eq("id", settlementId)
    .maybeSingle()

  if (!settlement?.driver_id) {
    return { error: "정산 정보를 찾을 수 없습니다." }
  }

  const { data: payment } = settlement.payment_id
    ? await supabase.from("payments").select("id, status").eq("id", settlement.payment_id).maybeSingle()
    : settlement.order_id
      ? await supabase
          .from("payments")
          .select("id, status")
          .eq("order_id", settlement.order_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null }

  const paymentStatus = payment?.status || settlement.payment_status
  if (paymentStatus !== "PAID") {
    return { error: "결제 승인 완료 후 정산 확정이 가능합니다." }
  }

  await supabase
    .from("settlements")
    .update({
      settlement_status: "CONFIRMED",
      status: "processing",
      confirmed_at: new Date().toISOString(),
      payment_status: paymentStatus,
    })
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

export async function bulkConfirmSettlements(settlementIds: string[]) {
  const serviceClient = await getServiceClient()
  const supabase = serviceClient || (await getSupabaseServerClient())

  const uniqueIds = Array.from(new Set(settlementIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { error: "선택된 정산이 없습니다." }
  }

  const { data: settlements, error } = await supabase
    .from("settlements")
    .select("id, driver_id, settlement_amount, settlement_status, status, confirmed_at, payment_id, order_id, payment_status")
    .in("id", uniqueIds)

  if (error) {
    return { error: error.message }
  }

  const settlementMap = new Map((settlements || []).map((settlement) => [settlement.id, settlement]))
  const paymentIds = (settlements || []).map((s) => s.payment_id).filter(Boolean) as string[]
  const orderIds = (settlements || []).map((s) => s.order_id).filter(Boolean) as string[]
  const paymentById = new Map<string, { status: string | null }>()
  const paymentByOrderId = new Map<string, { status: string | null; created_at?: string | null }>()

  if (paymentIds.length) {
    const { data: paymentsById } = await supabase.from("payments").select("id, status").in("id", paymentIds)
    for (const payment of paymentsById || []) {
      paymentById.set(payment.id, { status: payment.status })
    }
  }

  if (orderIds.length) {
    const { data: paymentsByOrder } = await supabase
      .from("payments")
      .select("id, order_id, status, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false })
    for (const payment of paymentsByOrder || []) {
      if (!payment.order_id) continue
      const existing = paymentByOrderId.get(payment.order_id)
      if (!existing || (payment.created_at && existing.created_at && payment.created_at > existing.created_at)) {
        paymentByOrderId.set(payment.order_id, { status: payment.status, created_at: payment.created_at })
      }
    }
  }
  const failed: Array<{ id: string; error: string }> = []
  let successCount = 0
  let skippedCount = 0
  let excludedCount = 0

  for (const settlementId of uniqueIds) {
    const settlement = settlementMap.get(settlementId)
    if (!settlement?.driver_id) {
      failed.push({ id: settlementId, error: "정산 정보를 찾을 수 없습니다." })
      continue
    }
    if (settlement.settlement_status !== "PENDING") {
      skippedCount += 1
      continue
    }
    const paymentStatus =
      (settlement.payment_id && paymentById.get(settlement.payment_id)?.status) ||
      (settlement.order_id && paymentByOrderId.get(settlement.order_id)?.status) ||
      settlement.payment_status
    if (paymentStatus !== "PAID") {
      excludedCount += 1
      continue
    }
    try {
      const confirmTime = new Date().toISOString()
      await supabase
        .from("settlements")
        .update({
          settlement_status: "CONFIRMED",
          status: "processing",
          confirmed_at: confirmTime,
          payment_status: paymentStatus,
        })
        .eq("id", settlementId)

      await ensureDriverWallet(settlement.driver_id)
      const { error: rpcError } = await supabase.rpc("move_driver_wallet_pending_to_available", {
        p_driver_id: settlement.driver_id,
        p_amount: Number(settlement.settlement_amount || 0),
      })
      if (rpcError) {
        throw rpcError
      }

      successCount += 1
    } catch (error) {
      await supabase
        .from("settlements")
        .update({
          settlement_status: "PENDING",
          status: settlement.status || "pending",
          confirmed_at: settlement.confirmed_at || null,
          payment_status: settlement.payment_status || null,
        })
        .eq("id", settlementId)
      failed.push({ id: settlementId, error: error instanceof Error ? error.message : "처리에 실패했습니다." })
    }
  }

  revalidatePath("/admin/settlements")
  revalidatePath("/driver/wallet")
  return { successCount, skippedCount, excludedCount, failed }
}

export async function unlockSettlement(settlementId: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "인증이 필요합니다." }
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") {
    return { error: "관리자 권한이 필요합니다." }
  }

  const serviceClient = await getServiceClient()
  const adminClient = serviceClient || supabase
  const { data: settlement } = await adminClient
    .from("settlements")
    .select("id, payment_status")
    .eq("id", settlementId)
    .maybeSingle()

  if (!settlement?.id) {
    return { error: "정산 정보를 찾을 수 없습니다." }
  }

  const nextStatus = settlement.payment_status === "PAID" ? "CONFIRMED" : "PENDING"
  await adminClient
    .from("settlements")
    .update({ settlement_status: nextStatus })
    .eq("id", settlementId)

  revalidatePath("/admin/settlements")
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

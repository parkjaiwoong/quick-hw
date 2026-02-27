"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getRoleOverride } from "@/lib/role"

// ??? ?? ?? ??
export async function getDriverSettlements(driverId?: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "??? ?????" }
  }

  const targetDriverId = driverId || user.id

  const { data, error } = await supabase
    .from("settlements")
    .select("*")
    .eq("driver_id", targetDriverId)
    .order("settlement_period_end", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { settlements: data }
}

// ?? ?? (???)
export async function createSettlement(driverId: string, startDate: string, endDate: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "??? ?????" }
  }

  // ??? ?? ??
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { error: "??? ??? ?????" }
  }

  // ?? ? ??? ?? ??
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("*")
    .eq("driver_id", driverId)
    .eq("status", "delivered")
    .gte("delivered_at", startDate)
    .lte("delivered_at", endDate)

  const totalDeliveries = deliveries?.length || 0
  const totalEarnings = deliveries?.reduce((sum, d) => sum + (d.driver_fee || 0), 0) || 0
  const platformFeeTotal = deliveries?.reduce((sum, d) => sum + (d.platform_fee || 0), 0) || 0
  const netEarnings = totalEarnings

  // ??? ?? ????
  const { data: driverInfo } = await supabase.from("driver_info").select("*").eq("id", driverId).single()

  const { data: settlement, error } = await supabase
    .from("settlements")
    .insert({
      driver_id: driverId,
      settlement_period_start: startDate,
      settlement_period_end: endDate,
      total_deliveries: totalDeliveries,
      total_earnings: totalEarnings,
      platform_fee_total: platformFeeTotal,
      net_earnings: netEarnings,
      bank_account: driverInfo?.bank_account,
      bank_name: driverInfo?.bank_name,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/settlements")
  revalidatePath("/driver/settlements")
  return { success: true, settlement }
}

// ?? ?? ??
export async function completeSettlement(settlementId: string, transactionId: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "??? ?????" }
  }

  // ??? ?? ??
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { error: "??? ??? ?????" }
  }

  const { error } = await supabase
    .from("settlements")
    .update({
      status: "completed",
      settlement_date: new Date().toISOString().split("T")[0],
      transaction_id: transactionId,
    })
    .eq("id", settlementId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/settlements")
  return { success: true }
}

// ?? ?? ?? (???)
export async function getAllSettlements() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "??? ?????" }
  }

  // ??? ?? ?? (roleOverride ??)
  const [{ data: profile }, roleOverride] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
  ])
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    return { error: "??? ??? ?????" }
  }

  const { data, error } = await supabase
    .from("settlements")
    .select(
      `
      *,
      driver:profiles!settlements_driver_id_fkey(full_name, email, phone),
      payment:payments!settlements_payment_id_fkey(amount, status)
    `,
    )
    .order("settlement_period_end", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { settlements: data }
}

/** ????: ??? ?? summary + ?? ?? */
export async function getSettlementsByDriver() {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "??? ?????" }

  const [{ data: profile }, roleOverride] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
  ])
  if (roleOverride !== "admin" && profile?.role !== "admin") {
    return { error: "??? ??? ?????" }
  }

  const { data, error } = await supabase
    .from("settlements")
    .select(
      `id, driver_id, settlement_amount, payment_status, settlement_status, status,
       settlement_period_start, settlement_period_end, created_at, confirmed_at,
       order_id, delivery_id,
       driver:profiles!settlements_driver_id_fkey(full_name, email, phone),
       payment:payments!settlements_payment_id_fkey(amount, status)`
    )
    .order("settlement_period_end", { ascending: false })

  if (error) return { error: error.message }

  type SettlementRow = NonNullable<typeof data>[number]
  type DriverGroup = {
    driver_id: string
    full_name: string
    email: string
    phone: string | null
    total_count: number
    paid_count: number
    canceled_count: number
    pending_count: number
    total_amount: number
    paid_amount: number
    canceled_amount: number
    pending_amount: number
    first_date: string | null
    last_date: string | null
    items: SettlementRow[]
  }

  const driverMap = new Map<string, DriverGroup>()

  for (const row of data ?? []) {
    const key = row.driver_id ?? "unknown"
    const driver = row.driver as { full_name?: string; email?: string; phone?: string } | null
    if (!driverMap.has(key)) {
      driverMap.set(key, {
        driver_id: key,
        full_name: driver?.full_name ?? "",
        email: driver?.email ?? "",
        phone: driver?.phone ?? null,
        total_count: 0,
        paid_count: 0,
        canceled_count: 0,
        pending_count: 0,
        total_amount: 0,
        paid_amount: 0,
        canceled_amount: 0,
        pending_amount: 0,
        first_date: null,
        last_date: null,
        items: [],
      })
    }
    const entry = driverMap.get(key)!
    const amt = Number(row.settlement_amount ?? 0)
    entry.total_count++
    entry.total_amount += amt
    if (row.payment_status === "PAID") { entry.paid_count++; entry.paid_amount += amt }
    else if (row.payment_status === "CANCELED") { entry.canceled_count++; entry.canceled_amount += amt }
    else { entry.pending_count++; entry.pending_amount += amt }
    const d = row.settlement_period_end ?? row.created_at ?? null
    if (d) {
      if (!entry.first_date || d < entry.first_date) entry.first_date = d
      if (!entry.last_date || d > entry.last_date) entry.last_date = d
    }
    entry.items.push(row)
  }

  return { driverGroups: Array.from(driverMap.values()) }
}

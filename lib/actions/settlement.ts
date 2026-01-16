"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// 배송원 정산 내역 조회
export async function getDriverSettlements(driverId?: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
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

// 정산 생성 (관리자)
export async function createSettlement(driverId: string, startDate: string, endDate: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // 관리자 권한 확인
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { error: "관리자 권한이 필요합니다" }
  }

  // 기간 내 완료된 배송 조회
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

  // 배송원 정보 가져오기
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

// 정산 완료 처리
export async function completeSettlement(settlementId: string, transactionId: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // 관리자 권한 확인
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { error: "관리자 권한이 필요합니다" }
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

// 모든 정산 조회 (관리자)
export async function getAllSettlements() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // 관리자 권한 확인
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { error: "관리자 권한이 필요합니다" }
  }

  const { data, error } = await supabase
    .from("settlements")
    .select(
      `
      *,
      driver:profiles!settlements_driver_id_fkey(full_name, email, phone)
    `,
    )
    .order("settlement_period_end", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { settlements: data }
}


"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getAllDeliveries() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("deliveries")
    .select(
      `
      *,
      customer:profiles!deliveries_customer_id_fkey(full_name, email, phone),
      driver:profiles!deliveries_driver_id_fkey(full_name, email, phone)
    `,
    )
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { deliveries: data }
}

export async function getDashboardStats() {
  const supabase = await getSupabaseServerClient()

  // 전체 배송 통계
  const { data: deliveries } = await supabase.from("deliveries").select("*")

  // 오늘 배송 통계
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: todayDeliveries } = await supabase.from("deliveries").select("*").gte("created_at", today.toISOString())

  // 총 수익 계산
  const { data: completedDeliveries } = await supabase
    .from("deliveries")
    .select("platform_fee")
    .eq("status", "delivered")

  const totalRevenue = completedDeliveries?.reduce((sum, d) => sum + (d.platform_fee || 0), 0) || 0

  // 오늘 수익
  const { data: todayCompleted } = await supabase
    .from("deliveries")
    .select("platform_fee")
    .eq("status", "delivered")
    .gte("delivered_at", today.toISOString())

  const todayRevenue = todayCompleted?.reduce((sum, d) => sum + (d.platform_fee || 0), 0) || 0

  // 사용자 통계
  const { count: customerCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "customer")

  const { count: driverCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "driver")

  return {
    stats: {
      totalDeliveries: deliveries?.length || 0,
      todayDeliveries: todayDeliveries?.length || 0,
      totalRevenue,
      todayRevenue,
      customerCount: customerCount || 0,
      driverCount: driverCount || 0,
      pendingDeliveries: deliveries?.filter((d) => d.status === "pending").length || 0,
      activeDeliveries:
        deliveries?.filter((d) => ["accepted", "picked_up", "in_transit"].includes(d.status)).length || 0,
    },
  }
}

export async function getAllDrivers() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      *,
      driver_info(*)
    `,
    )
    .eq("role", "driver")

  if (error) {
    return { error: error.message }
  }

  return { drivers: data }
}

export async function getAllCustomers() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase.from("profiles").select("*").eq("role", "customer")

  if (error) {
    return { error: error.message }
  }

  return { customers: data }
}

export async function getPricingConfig() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("pricing_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  return { pricing: data }
}

export async function updatePricingConfig(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("인증이 필요합니다")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const { getRoleOverride } = await import("@/lib/role")
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    throw new Error("권한이 없습니다")
  }

  const baseFee = Number(formData.get("base_fee")) || 0
  const perKmFee = Number(formData.get("per_km_fee")) || 0
  const platformCommissionRate = Number(formData.get("platform_commission_rate")) || 0
  const minDriverFee = Number(formData.get("min_driver_fee")) || 0

  const { data: existing } = await supabase
    .from("pricing_config")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from("pricing_config")
      .update({
        base_fee: baseFee,
        per_km_fee: perKmFee,
        platform_commission_rate: platformCommissionRate,
        min_driver_fee: minDriverFee,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    if (error) {
      if (error.message?.includes("pricing_config") || error.message?.includes("schema cache")) {
        throw new Error("가격 정책 테이블이 없습니다. scripts/003_seed_data.sql 을 실행해주세요.")
      }
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabase.from("pricing_config").insert({
      base_fee: baseFee,
      per_km_fee: perKmFee,
      platform_commission_rate: platformCommissionRate,
      min_driver_fee: minDriverFee,
    })

    if (error) {
      if (error.message?.includes("pricing_config") || error.message?.includes("schema cache")) {
        throw new Error("가격 정책 테이블이 없습니다. scripts/003_seed_data.sql 을 실행해주세요.")
      }
      throw new Error(error.message)
    }
  }

  revalidatePath("/admin/pricing")
}

export async function updatePricingConfigWithState(
  _prevState: { status: string; message?: string },
  formData: FormData,
): Promise<{ status: "success" | "error"; message?: string }> {
  try {
    await updatePricingConfig(formData)
    return { status: "success" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "저장에 실패했습니다."
    return { status: "error", message }
  }
}

export async function createTaxInvoice(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  // 배송 정보 가져오기
  const { data: delivery } = await supabase.from("deliveries").select("*").eq("id", deliveryId).single()

  if (!delivery) {
    return { error: "배송 정보를 찾을 수 없습니다" }
  }

  // 플랫폼 설정 가져오기
  const { data: platform } = await supabase.from("platform_settings").select("*").single()

  if (!platform) {
    return { error: "플랫폼 설정을 찾을 수 없습니다" }
  }

  // 고객 정보 가져오기
  const { data: customer } = await supabase.from("profiles").select("*").eq("id", delivery.customer_id).single()

  // 세금계산서 번호 생성
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`

  // 공급가액과 세액 계산 (10% 부가세)
  const supplyAmount = Math.floor((delivery.platform_fee * 10) / 11)
  const taxAmount = delivery.platform_fee - supplyAmount

  const { data: invoice, error } = await supabase
    .from("tax_invoices")
    .insert({
      delivery_id: deliveryId,
      invoice_number: invoiceNumber,
      issue_date: new Date().toISOString().split("T")[0],
      supplier_business_number: platform.business_number,
      supplier_name: platform.company_name,
      supplier_address: platform.company_address,
      buyer_name: customer?.full_name || "고객",
      buyer_address: delivery.delivery_address,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: delivery.platform_fee,
      status: "issued",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin")
  return { success: true, invoice }
}

export async function getRevenueReport(startDate: string, endDate: string) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("status", "delivered")
    .gte("delivered_at", startDate)
    .lte("delivered_at", endDate)
    .order("delivered_at", { ascending: true })

  if (error) {
    return { error: error.message }
  }

  const totalRevenue = data.reduce((sum, d) => sum + (d.platform_fee || 0), 0)
  const totalDeliveries = data.length

  return {
    report: {
      startDate,
      endDate,
      totalRevenue,
      totalDeliveries,
      avgRevenuePerDelivery: totalDeliveries > 0 ? totalRevenue / totalDeliveries : 0,
      deliveries: data,
    },
  }
}

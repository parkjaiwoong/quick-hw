"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// 사고 접수 생성
export async function reportAccident(data: {
  deliveryId?: string
  accidentType: string
  accidentDate: string
  accidentLocation?: string
  accidentDescription: string
  vehicleDamageDescription?: string
  packageDamageDescription?: string
  injuryDescription?: string
  witnessInfo?: string
  photos?: string[]
}) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // 배송 정보 가져오기
  let deliveryId = data.deliveryId
  let driverId = null
  let customerId = null

  if (deliveryId) {
    const { data: delivery } = await supabase.from("deliveries").select("*").eq("id", deliveryId).single()
    if (delivery) {
      driverId = delivery.driver_id
      customerId = delivery.customer_id
    }
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (profile?.role === "driver") {
    driverId = user.id
  } else if (profile?.role === "customer") {
    customerId = user.id
  }

  const { data: accident, error } = await supabase
    .from("accident_reports")
    .insert({
      delivery_id: deliveryId,
      reporter_id: user.id,
      driver_id: driverId,
      customer_id: customerId,
      accident_type: data.accidentType,
      accident_date: data.accidentDate,
      accident_location: data.accidentLocation,
      accident_description: data.accidentDescription,
      vehicle_damage_description: data.vehicleDamageDescription,
      package_damage_description: data.packageDamageDescription,
      injury_description: data.injuryDescription,
      witness_info: data.witnessInfo,
      photos: data.photos ? JSON.stringify(data.photos) : null,
      status: "reported",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/accidents")
  return { success: true, accident }
}

// 사고 목록 조회
export async function getAccidentReports(userId?: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  let query = supabase.from("accident_reports").select(`
    *,
    delivery:deliveries(id, pickup_address, delivery_address),
    reporter:profiles!accident_reports_reporter_id_fkey(full_name, email),
    driver:profiles!accident_reports_driver_id_fkey(full_name, email),
    customer:profiles!accident_reports_customer_id_fkey(full_name, email)
  `)

  // 관리자가 아니면 자신과 관련된 사고만 조회
  if (profile?.role !== "admin") {
    if (profile?.role === "driver") {
      query = query.eq("driver_id", user.id)
    } else if (profile?.role === "customer") {
      query = query.eq("customer_id", user.id)
    } else {
      query = query.eq("reporter_id", user.id)
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { accidents: data }
}

// 사고 상태 업데이트 (관리자)
export async function updateAccidentStatus(
  accidentId: string,
  status: string,
  investigationNotes?: string,
  resolution?: string,
  compensationAmount?: number,
) {
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

  const updateData: any = {
    status,
    assigned_to: user.id,
  }

  if (investigationNotes) {
    updateData.investigation_notes = investigationNotes
  }
  if (resolution) {
    updateData.resolution = resolution
  }
  if (compensationAmount !== undefined) {
    updateData.compensation_amount = compensationAmount
  }

  const { error } = await supabase.from("accident_reports").update(updateData).eq("id", accidentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/accidents")
  return { success: true }
}


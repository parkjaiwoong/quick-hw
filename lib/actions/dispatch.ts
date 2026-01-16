"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// 배차 가능한 배송원 조회
export async function getAvailableDriversForDispatch() {
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
    .from("profiles")
    .select(
      `
      *,
      driver_info(*)
    `,
    )
    .eq("role", "driver")
    .eq("is_active", true)

  if (error) {
    return { error: error.message }
  }

  // 배송 가능한 배송원만 필터링
  const availableDrivers = data?.filter((driver: any) => driver.driver_info?.is_available) || []

  return { drivers: availableDrivers }
}

// 배송에 배송원 배차
export async function dispatchDriver(deliveryId: string, driverId: string) {
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

  // 배송 정보 확인
  const { data: delivery } = await supabase.from("deliveries").select("*").eq("id", deliveryId).single()

  if (!delivery) {
    return { error: "배송 정보를 찾을 수 없습니다" }
  }

  if (delivery.status !== "pending") {
    return { error: "배차 가능한 상태가 아닙니다" }
  }

  if (delivery.driver_id) {
    return { error: "이미 배송원이 배차되었습니다" }
  }

  // 배송원 배차
  const { error } = await supabase
    .from("deliveries")
    .update({
      driver_id: driverId,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)

  if (error) {
    return { error: error.message }
  }

  // 배송원에게 알림 생성
  await supabase.from("notifications").insert({
    user_id: driverId,
    delivery_id: deliveryId,
    title: "배송 배차 알림",
    message: `관리자가 배송을 배차했습니다. 배송 상세를 확인하세요.`,
    type: "delivery_update",
  })

  // 고객에게 알림 생성
  if (delivery.customer_id) {
    await supabase.from("notifications").insert({
      user_id: delivery.customer_id,
      delivery_id: deliveryId,
      title: "배송원 배차 완료",
      message: `배송원이 배차되었습니다. 배송을 추적할 수 있습니다.`,
      type: "delivery_update",
    })
  }

  revalidatePath("/admin/dispatch")
  revalidatePath("/admin")
  return { success: true }
}

// 배차 취소
export async function cancelDispatch(deliveryId: string) {
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

  // 배송 정보 가져오기
  const { data: delivery } = await supabase.from("deliveries").select("*").eq("id", deliveryId).single()

  if (!delivery) {
    return { error: "배송 정보를 찾을 수 없습니다" }
  }

  // 배차 취소 (pending 상태로 변경)
  const { error } = await supabase
    .from("deliveries")
    .update({
      driver_id: null,
      status: "pending",
      accepted_at: null,
    })
    .eq("id", deliveryId)

  if (error) {
    return { error: error.message }
  }

  // 배송원에게 알림
  if (delivery.driver_id) {
    await supabase.from("notifications").insert({
      user_id: delivery.driver_id,
      delivery_id: deliveryId,
      title: "배차 취소 알림",
      message: `관리자가 배차를 취소했습니다.`,
      type: "delivery_update",
    })
  }

  revalidatePath("/admin/dispatch")
  return { success: true }
}


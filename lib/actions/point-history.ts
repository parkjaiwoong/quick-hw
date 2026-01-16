"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getRoleOverride } from "@/lib/role"
import { revalidatePath } from "next/cache"

export async function updateCustomerPoints(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("인증이 필요합니다")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    throw new Error("권한이 없습니다")
  }

  const rawCustomer = String(formData.get("customer") || "").trim()
  const rawPoints = String(formData.get("points") || "").trim()
  const type = String(formData.get("type") || "").trim()
  const reason = String(formData.get("reason") || "").trim()

  if (!rawCustomer || !rawPoints || !type) {
    throw new Error("필수 값이 누락되었습니다")
  }

  const points = Number(rawPoints)
  if (!Number.isFinite(points) || points === 0) {
    throw new Error("포인트 값을 확인해주세요")
  }

  if (type !== "earn" && type !== "use" && type !== "adjust") {
    throw new Error("포인트 구분이 올바르지 않습니다")
  }

  if (type !== "adjust" && points < 0) {
    throw new Error("적립/사용은 양수로 입력해주세요")
  }

  let customerId = rawCustomer
  if (rawCustomer.includes("@")) {
    const { data: customer, error: customerError } = await supabase
      .from("customer")
      .select("id")
      .eq("email", rawCustomer)
      .single()
    if (customerError || !customer) {
      throw new Error("고객을 찾을 수 없습니다")
    }
    customerId = customer.id
  }

  const { data: history } = await supabase
    .from("customer_point_history")
    .select("points, type")
    .eq("customer_id", customerId)

  const balance =
    history?.reduce((sum, row: any) => {
      if (row.type === "earn") return sum + Number(row.points)
      if (row.type === "use") return sum - Number(row.points)
      return sum + Number(row.points)
    }, 0) || 0

  const nextBalance =
    type === "earn" ? balance + points : type === "use" ? balance - points : balance + points

  if (nextBalance < 0) {
    throw new Error("포인트가 부족합니다")
  }

  const { error } = await supabase.from("customer_point_history").insert({
    customer_id: customerId,
    points,
    type,
    reason: reason || null,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/point-history")
}

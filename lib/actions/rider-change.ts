"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getRoleOverride } from "@/lib/role"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateRiderChangeRequest(formData: FormData): Promise<void> {
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

  const requestId = String(formData.get("id") || "").trim()
  const action = String(formData.get("action") || "").trim()
  const adminReason = String(formData.get("admin_reason") || "").trim()
  const redirectTo = String(formData.get("redirect_to") || "").trim()

  if (!requestId || !["approve", "deny"].includes(action)) {
    throw new Error("요청 정보를 확인해주세요")
  }

  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error("Service Role Key가 설정되지 않았습니다.")
  }

  const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)

  const { data: request } = await supabaseService
    .from("rider_change_history")
    .select("id, customer_id, from_rider_id, to_rider_id, status")
    .eq("id", requestId)
    .single()

  if (!request) {
    throw new Error("요청을 찾을 수 없습니다")
  }

  if (request.status !== "pending") {
    return
  }

  if (action === "deny") {
    const { error } = await supabaseService
      .from("rider_change_history")
      .update({
        status: "denied",
        admin_reason: adminReason || null,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        cooldown_until: null,
      })
      .eq("id", requestId)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { data: currentReferral } = await supabaseService
      .from("rider_customer_referral")
      .select("id, rider_id")
      .eq("customer_id", request.customer_id)
      .maybeSingle()

    if (currentReferral?.id) {
      const { error: referralUpdateError } = await supabaseService
        .from("rider_customer_referral")
        .update({
          rider_id: request.to_rider_id,
          status: "active",
          assigned_via: "admin",
          assigned_at: new Date().toISOString(),
          last_touch_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        })
        .eq("id", currentReferral.id)

      if (referralUpdateError) {
        throw new Error(referralUpdateError.message)
      }
    } else {
      const { error: referralInsertError } = await supabaseService.from("rider_customer_referral").insert({
        customer_id: request.customer_id,
        rider_id: request.to_rider_id,
        status: "active",
        assigned_via: "admin",
        assigned_at: new Date().toISOString(),
        last_touch_at: new Date().toISOString(),
      })

      if (referralInsertError) {
        throw new Error(referralInsertError.message)
      }
    }

    await supabaseService
      .from("profiles")
      .update({ referring_driver_id: request.to_rider_id })
      .eq("id", request.customer_id)

    const { error } = await supabaseService
      .from("rider_change_history")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        cooldown_until: null,
      })
      .eq("id", requestId)

    if (error) {
      throw new Error(error.message)
    }
  }

  revalidatePath("/admin/rider-change-requests")
  revalidatePath("/customer")
  revalidatePath("/customer/rider-change-request")

  if (redirectTo) {
    const url = new URL(redirectTo, "http://localhost")
    url.searchParams.set("result", "success")
    url.searchParams.set("action", action)
    redirect(url.toString())
  }
}

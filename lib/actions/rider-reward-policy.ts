"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getRoleOverride } from "@/lib/role"
import { revalidatePath } from "next/cache"

function toRatePercent(value: FormDataEntryValue | null) {
  const percent = Number(value)
  if (!Number.isFinite(percent) || percent < 0) return 0
  return percent / 100
}

function toDateValue(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : ""
  return text ? new Date(text).toISOString() : null
}

export async function getRiderOverrides() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("rider_reward_policy")
    .select("id, rider_id, rider_reward_rate, active_from, active_to, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { overrides: data }
}

export async function updateRiderOverride(formData: FormData): Promise<void> {
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

  const riderId = String(formData.get("rider_id") || "").trim()
  if (!riderId) {
    throw new Error("기사 선택이 필요합니다")
  }

  const riderRewardRate = toRatePercent(formData.get("rider_reward_rate"))
  const activeFrom = toDateValue(formData.get("active_from"))
  const activeTo = toDateValue(formData.get("active_to"))

  const { data: existing } = await supabase
    .from("rider_reward_policy")
    .select("id")
    .eq("rider_id", riderId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from("rider_reward_policy")
      .update({
        rider_reward_rate: riderRewardRate,
        active_from: activeFrom ?? new Date().toISOString(),
        active_to: activeTo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabase.from("rider_reward_policy").insert({
      rider_id: riderId,
      rider_reward_rate: riderRewardRate,
      active_from: activeFrom ?? new Date().toISOString(),
      active_to: activeTo,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  revalidatePath("/admin/rider-reward-policy")
}

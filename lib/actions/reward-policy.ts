"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getRoleOverride } from "@/lib/role"
import { revalidatePath } from "next/cache"

function toRatePercent(value: FormDataEntryValue | null) {
  const percent = Number(value)
  if (!Number.isFinite(percent) || percent < 0) return 0
  return percent / 100
}

export async function getRewardPolicy() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("reward_policy_master")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  return { policy: data }
}

export async function updateRewardPolicy(formData: FormData): Promise<void> {
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

  const riderRewardRate = toRatePercent(formData.get("rider_reward_rate"))
  const companyShareRate = toRatePercent(formData.get("company_share_rate"))
  const customerRewardRate = toRatePercent(formData.get("customer_reward_rate"))

  const { data: existing } = await supabase
    .from("reward_policy_master")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from("reward_policy_master")
      .update({
        rider_reward_rate: riderRewardRate,
        company_share_rate: companyShareRate,
        customer_reward_rate: customerRewardRate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabase.from("reward_policy_master").insert({
      rider_reward_rate: riderRewardRate,
      company_share_rate: companyShareRate,
      customer_reward_rate: customerRewardRate,
      is_active: true,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  revalidatePath("/admin/reward-policy")
}

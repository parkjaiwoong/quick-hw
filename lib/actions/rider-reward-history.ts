"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getRoleOverride } from "@/lib/role"
import { revalidatePath } from "next/cache"

export async function updateRiderRewardStatus(formData: FormData): Promise<void> {
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

  const id = String(formData.get("id") || "").trim()
  const status = String(formData.get("status") || "").trim()
  if (!id || !status) {
    throw new Error("필수 값이 누락되었습니다")
  }

  const { error } = await supabase
    .from("rider_reward_history")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/rider-rewards")
}

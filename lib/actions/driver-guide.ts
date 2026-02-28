"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/** 기사 온보딩 가이드 완료 처리 */
export async function completeDriverGuide() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다." }

  const { error } = await supabase
    .from("driver_info")
    .update({ guide_completed_at: new Date().toISOString() })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/driver")
  return { success: true }
}

/** 기사 온보딩 가이드 완료 여부 조회 */
export async function getGuideStatus(): Promise<{ completed: boolean }> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { completed: false }

  const { data } = await supabase
    .from("driver_info")
    .select("guide_completed_at")
    .eq("id", user.id)
    .maybeSingle()

  return { completed: !!data?.guide_completed_at }
}

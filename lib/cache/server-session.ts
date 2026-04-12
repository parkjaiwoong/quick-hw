import { cache } from "react"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

/**
 * 동일 RSC 요청(레이아웃 + 페이지)에서 auth.getUser() 중복 호출을 막아
 * Supabase 왕복·세션 갱신 비용을 줄입니다.
 */
export const getCachedAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
})

/** 레이아웃·페이지에서 동일 프로필 행을 한 번만 조회 */
export const getCachedProfileRow = cache(
  async (userId: string): Promise<{
    role?: string | null
    full_name?: string | null
    avatar_url?: string | null
    referring_driver_id?: string | null
  } | null> => {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase
      .from("profiles")
      .select("role, full_name, avatar_url, referring_driver_id")
      .eq("id", userId)
      .maybeSingle()
    return data ?? null
  },
)

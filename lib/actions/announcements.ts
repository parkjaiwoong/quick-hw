"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type TargetAudience = "customer" | "driver" | "common"

export type Announcement = {
  id: string
  title: string
  content: string
  is_pinned: boolean
  target_audience: TargetAudience
  created_by: string | null
  created_at: string
  updated_at: string
}

/** 공지사항 목록 조회
 * - role 'customer': 고객용 + 공통
 * - role 'driver': 기사용 + 공통
 * - role 'admin' 또는 미지정: 전체 (관리용)
 */
export async function getAnnouncements(role?: "customer" | "driver" | "admin") {
  const supabase = await getSupabaseServerClient()
  let query = supabase
    .from("announcements")
    .select("id, title, content, is_pinned, target_audience, created_by, created_at, updated_at")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  if (role === "customer") {
    query = query.in("target_audience", ["customer", "common"])
  } else if (role === "driver") {
    query = query.in("target_audience", ["driver", "common"])
  }

  const { data, error } = await query
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []) as Announcement[], error: null }
}

/** 관리자: 공지사항 등록 */
export async function createAnnouncement(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다" }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "관리자 권한이 필요합니다" }

  const title = String(formData.get("title") ?? "").trim()
  const content = String(formData.get("content") ?? "").trim()
  const is_pinned = formData.get("is_pinned") === "on"
  const rawTarget = formData.get("target_audience") as string
  const target_audience = ["customer", "driver", "common"].includes(rawTarget) ? rawTarget : "common"

  if (!title || !content) return { error: "제목과 내용을 입력해주세요" }

  const { error } = await supabase.from("announcements").insert({
    title,
    content,
    is_pinned,
    target_audience,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath("/admin/announcements")
  revalidatePath("/announcements")
  return { success: true }
}

/** 관리자: 공지사항 수정 */
export async function updateAnnouncement(id: string, formData: FormData) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다" }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "관리자 권한이 필요합니다" }

  const title = String(formData.get("title") ?? "").trim()
  const content = String(formData.get("content") ?? "").trim()
  const is_pinned = formData.get("is_pinned") === "on"
  const rawTarget = formData.get("target_audience") as string
  const target_audience = ["customer", "driver", "common"].includes(rawTarget) ? rawTarget : "common"

  if (!title || !content) return { error: "제목과 내용을 입력해주세요" }

  const { error } = await supabase
    .from("announcements")
    .update({ title, content, is_pinned, target_audience, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/admin/announcements")
  revalidatePath("/announcements")
  return { success: true }
}

/** 관리자: 공지사항 삭제 (폼에서 id 전달) */
export async function deleteAnnouncementById(formData: FormData) {
  const id = formData.get("id") as string
  if (!id) return
  return deleteAnnouncement(id)
}

/** 관리자: 공지사항 삭제 */
export async function deleteAnnouncement(id: string) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다" }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "관리자 권한이 필요합니다" }

  const { error } = await supabase.from("announcements").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/announcements")
  revalidatePath("/announcements")
  return { success: true }
}

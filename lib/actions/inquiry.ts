"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function submitInquiry(data: { title: string; message: string }) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  const { error } = await supabase.from("notifications").insert({
    user_id: user.id,
    title: data.title,
    message: data.message,
    type: "inquiry",
    is_read: false,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/inquiries")
  revalidatePath("/customer/inquiry")
  return { success: true }
}

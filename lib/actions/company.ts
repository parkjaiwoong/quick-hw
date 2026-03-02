"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath, unstable_cache } from "next/cache"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export interface CompanyInfo {
  id?: string
  company_name: string
  business_number: string | null
  ceo_name: string | null
  company_address: string | null
  contact_phone: string | null
  contact_email: string | null
  website_url: string | null
  kakao_channel: string | null
  logo_url: string | null
  stamp_url: string | null
}

function getServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, key, {
    auth: { persistSession: false },
  })
}

/** 회사 정보 조회 (캐시 30초) — 헤더/영수증 등 공개 컴포넌트에서 사용 */
export const getCompanyInfo = unstable_cache(
  async (): Promise<CompanyInfo | null> => {
    const svc = getServiceRoleClient()
    const client = svc ?? (await getSupabaseServerClient())
    const { data } = await client
      .from("platform_settings")
      .select(
        "id, company_name, business_number, ceo_name, company_address, contact_phone, contact_email, website_url, kakao_channel, logo_url, stamp_url",
      )
      .maybeSingle()
    return data ?? null
  },
  ["company_info"],
  { revalidate: 30 },
)

/** 관리자: 회사 정보 저장 (upsert) */
export async function saveCompanyInfo(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다." }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "관리자 권한이 필요합니다." }

  const svc = getServiceRoleClient()
  const client = svc ?? supabase

  const payload: Record<string, string | null> = {
    company_name:    (formData.get("company_name") as string)?.trim() || "퀵HW언넌",
    business_number: (formData.get("business_number") as string)?.trim() || null,
    ceo_name:        (formData.get("ceo_name") as string)?.trim() || null,
    company_address: (formData.get("company_address") as string)?.trim() || null,
    contact_phone:   (formData.get("contact_phone") as string)?.trim() || null,
    contact_email:   (formData.get("contact_email") as string)?.trim() || null,
    website_url:     (formData.get("website_url") as string)?.trim() || null,
    kakao_channel:   (formData.get("kakao_channel") as string)?.trim() || null,
  }

  const { data: existing } = await client.from("platform_settings").select("id").maybeSingle()

  let error
  if (existing?.id) {
    ;({ error } = await client.from("platform_settings").update(payload).eq("id", existing.id))
  } else {
    ;({ error } = await client.from("platform_settings").insert(payload))
  }

  if (error) return { error: error.message }

  revalidatePath("/admin/company")
  revalidatePath("/", "layout")
  return { success: true }
}

/** 관리자: 이미지 업로드 (logo | stamp) */
export async function uploadCompanyImage(formData: FormData, type: "logo" | "stamp") {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다." }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "관리자 권한이 필요합니다." }

  const file = formData.get("file") as File | null
  if (!file || file.size === 0) return { error: "파일을 선택해주세요." }
  if (file.size > 5 * 1024 * 1024) return { error: "파일 크기는 5MB 이하여야 합니다." }
  if (!file.type.startsWith("image/")) return { error: "이미지 파일만 업로드 가능합니다." }

  const svc = getServiceRoleClient()
  const client = svc ?? supabase

  const ext = file.name.split(".").pop() ?? "png"
  const path = `${type}/${type}_${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await client.storage
    .from("company-assets")
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = client.storage.from("company-assets").getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  // platform_settings 업데이트
  const column = type === "logo" ? "logo_url" : "stamp_url"
  const { data: existing } = await client.from("platform_settings").select("id").maybeSingle()
  if (existing?.id) {
    await client.from("platform_settings").update({ [column]: publicUrl }).eq("id", existing.id)
  } else {
    await client.from("platform_settings").insert({ [column]: publicUrl })
  }

  revalidatePath("/admin/company")
  revalidatePath("/", "layout")
  return { success: true, url: publicUrl }
}

/** 관리자: 이미지 삭제 (logo | stamp) */
export async function deleteCompanyImage(type: "logo" | "stamp") {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "인증이 필요합니다." }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "관리자 권한이 필요합니다." }

  const svc = getServiceRoleClient()
  const client = svc ?? supabase

  const column = type === "logo" ? "logo_url" : "stamp_url"
  const { data: existing } = await client.from("platform_settings").select("id").maybeSingle()
  if (existing?.id) {
    await client.from("platform_settings").update({ [column]: null }).eq("id", existing.id)
  }

  revalidatePath("/admin/company")
  revalidatePath("/", "layout")
  return { success: true }
}

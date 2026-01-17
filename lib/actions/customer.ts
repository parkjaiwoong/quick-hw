"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getRoleOverride } from "@/lib/role"
import { revalidatePath } from "next/cache"

type ReferringDriverState = {
  status: "idle" | "success" | "error"
  message?: string
}

export async function updateReferringDriver(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("인증이 필요합니다")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) {
    throw new Error("권한이 없습니다")
  }

  const rawReferringDriverId = String(formData.get("referringDriverId") || "").trim()
  const referringDriverId = rawReferringDriverId.length > 0 ? rawReferringDriverId : null

  if (referringDriverId && referringDriverId === user.id) {
    throw new Error("본인을 추천 기사로 등록할 수 없습니다")
  }

  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error("서버 설정 오류가 발생했습니다")
  }

  const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey)

  if (referringDriverId) {
    const { data: driverProfile } = await supabaseService
      .from("profiles")
      .select("id")
      .eq("id", referringDriverId)
      .eq("role", "driver")
      .maybeSingle()

    if (!driverProfile) {
      throw new Error("유효한 추천 기사 ID가 아닙니다")
    }
  }

  const { error } = await supabaseService
    .from("profiles")
    .update({
      referring_driver_id: referringDriverId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/customer")
}

export async function updateReferringDriverWithState(
  _prevState: ReferringDriverState,
  formData: FormData,
): Promise<ReferringDriverState> {
  try {
    await updateReferringDriver(formData)
    return { status: "success", message: "추천 기사 ID가 저장되었습니다." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "저장에 실패했습니다.",
    }
  }
}

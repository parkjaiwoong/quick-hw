"use server"

import { cookies, headers } from "next/headers"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const REFERRAL_COOKIE = "rider_referral_code"
const SESSION_COOKIE = "rider_referral_session"

async function getClientIp() {
  const headerList = await headers()
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "0.0.0.0"
  )
}

async function getUserAgent() {
  const headerList = await headers()
  return headerList.get("user-agent") || ""
}

async function getSessionId() {
  const store = await cookies()
  const existing = store.get(SESSION_COOKIE)?.value
  if (existing) return existing
  const sessionId = crypto.randomUUID()
  store.set(SESSION_COOKIE, sessionId, { path: "/", maxAge: 60 * 60 * 24 * 30 })
  return sessionId
}

export async function handleRiderUrlAccess(
  riderCode: string,
  options?: { sessionId?: string; skipCookie?: boolean },
) {
  const trimmedCode = typeof riderCode === "string" ? riderCode.trim() : ""
  if (!trimmedCode) {
    return { status: "error", reason: "missing_code" }
  }
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const ip = await getClientIp()
  const ua = await getUserAgent()
  const sessionId = options?.sessionId || (await getSessionId())

  const { data, error } = await supabase.rpc("rider_url_visit", {
    p_code: trimmedCode,
    p_ip: ip,
    p_ua: ua,
    p_session_id: sessionId,
    p_device_fp: null,
  })

  if (error) {
    return { status: "error", reason: error.message }
  }

  if (!user && !options?.skipCookie) {
    const store = await cookies()
    store.set(REFERRAL_COOKIE, trimmedCode, { path: "/", maxAge: 60 * 60 * 24 * 30 })
  }

  return data as { status: string; reason?: string; rider_id?: string }
}

export async function confirmReferralFromCookie() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const store = await cookies()
  const referralCode = store.get(REFERRAL_COOKIE)?.value
  if (!referralCode) return

  const { data, error } = await supabase.rpc("confirm_customer_referral", {
    p_code: referralCode,
    p_ip: await getClientIp(),
    p_ua: await getUserAgent(),
    p_session_id: await getSessionId(),
  })

  if (!error && data?.status === "assigned") {
    store.delete(REFERRAL_COOKIE)
    revalidatePath("/customer")
  }
}

export async function requestRiderChange(formData: FormData) {
  const supabase = await getSupabaseServerClient()

  const toCode = String(formData.get("rider_code") || "").trim()
  const reason = String(formData.get("reason") || "").trim()

  if (!toCode) {
    return { error: "기사 코드를 입력해주세요." }
  }

  const { data, error } = await supabase.rpc("request_rider_change", {
    p_to_code: toCode,
    p_reason: reason || null,
    p_ip: await getClientIp(),
    p_ua: await getUserAgent(),
  })

  if (error) {
    return { error: error.message }
  }

  let requestId: string | null = null
  if (data?.status === "pending") {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: latestRequest } = await supabase
        .from("rider_change_history")
        .select("id")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      requestId = latestRequest?.id ?? null
    }
  }

  revalidatePath("/customer")
  return { success: true, result: data, requestId }
}

type RiderChangeState = {
  status: "idle" | "success" | "error"
  changeStatus?: string
  cooldownUntil?: string
  reason?: string
  requestId?: string | null
}

const riderChangeInitialState: RiderChangeState = { status: "idle" }

export async function requestRiderChangeWithState(
  _prevState: RiderChangeState = riderChangeInitialState,
  formData: FormData,
): Promise<RiderChangeState> {
  const result = await requestRiderChange(formData)

  if (result?.error) {
    return {
      status: "error",
      changeStatus: "error",
      reason: result.error,
    }
  }

  const changeStatus = result?.result?.status || "pending"
  const cooldownUntil = result?.result?.cooldown_until
  return {
    status: "success",
    changeStatus,
    cooldownUntil,
    reason: result?.result?.reason,
    requestId: result?.requestId ?? null,
  }
}

export async function resolveRiderForOrder(customerId: string) {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.rpc("resolve_rider_for_order", {
    p_customer_id: customerId,
    p_order_at: new Date().toISOString(),
  })

  if (error) {
    return { error: error.message }
  }

  return { riderId: data as string | null }
}

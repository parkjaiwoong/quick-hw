"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
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

function getSessionId() {
  const store = cookies()
  const existing = store.get(SESSION_COOKIE)?.value
  if (existing) return existing
  const sessionId = crypto.randomUUID()
  store.set(SESSION_COOKIE, sessionId, { path: "/", maxAge: 60 * 60 * 24 * 30 })
  return sessionId
}

// 1) /r/{rider_code} 접근 처리
export async function handleRiderUrlAccess(riderCode: string) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase.rpc("rider_url_visit", {
    p_code: riderCode,
    p_ip: await getClientIp(),
    p_ua: await getUserAgent(),
    p_session_id: getSessionId(),
    p_device_fp: null,
  })

  if (error) {
    return { status: "error", reason: error.message }
  }

  if (!user) {
    cookies().set(REFERRAL_COOKIE, riderCode, { path: "/", maxAge: 60 * 60 * 24 * 30 })
  }

  return data as { status: string; reason?: string; rider_id?: string }
}

// 2) 회원가입/로그인 완료 시 귀속 확정
export async function confirmReferralFromCookie() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const referralCode = cookies().get(REFERRAL_COOKIE)?.value
  if (!referralCode) return

  const { data, error } = await supabase.rpc("confirm_customer_referral", {
    p_code: referralCode,
    p_ip: await getClientIp(),
    p_ua: await getUserAgent(),
    p_session_id: getSessionId(),
  })

  if (!error && data?.status === "assigned") {
    cookies().delete(REFERRAL_COOKIE)
    revalidatePath("/customer")
  }
}

// 3) 고객 기사 변경 요청
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

  revalidatePath("/customer")
  return { success: true, result: data }
}

export async function requestRiderChangeAction(formData: FormData) {
  const result = await requestRiderChange(formData)
  if (result?.error) {
    const reason = encodeURIComponent(result.error)
    redirect(`/customer?change=error&reason=${reason}`)
  }

  const status = result?.result?.status || "pending"
  const cooldownUntil = result?.result?.cooldown_until
  const query = cooldownUntil ? `change=${status}&until=${encodeURIComponent(cooldownUntil)}` : `change=${status}`
  redirect(`/customer?${query}`)
}

// 4) 주문 생성 시 기사 결정 + RPC 호출
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

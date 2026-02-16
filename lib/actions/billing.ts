"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

const TOSS_BILLING_ISSUE_URL = "https://api.tosspayments.com/v1/billing/authorizations/issue"

/** authKey·customerKey로 토스 빌링키 발급 후 DB 저장 (billing-success 콜백용) */
export async function issueBillingKeyFromAuth(authKey: string, customerKey: string) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }
  if (customerKey !== user.id) return { error: "고객 정보가 일치하지 않습니다." }

  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) return { error: "토스 시크릿 키가 설정되지 않았습니다." }

  const encodedKey = Buffer.from(`${secretKey}:`).toString("base64")
  const res = await fetch(TOSS_BILLING_ISSUE_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ authKey, customerKey }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    billingKey?: string
    cardCompany?: string
    cardNumber?: string
    code?: string
    message?: string
  }

  if (!res.ok) {
    return { error: data?.message || data?.code || "빌링키 발급에 실패했습니다." }
  }
  if (!data.billingKey) return { error: "빌링키를 받지 못했습니다." }

  const { error } = await supabase.from("customer_billing_keys").upsert(
    {
      user_id: user.id,
      customer_key: customerKey,
      billing_key: data.billingKey,
      card_company: data.cardCompany || null,
      card_number_masked: data.cardNumber || null,
      pg_provider: "TOSS",
    },
    { onConflict: "user_id" },
  )

  if (error) return { error: error.message }
  return { success: true }
}

export type BillingKeyRow = {
  id: string
  user_id: string
  customer_key: string
  billing_key: string
  card_company: string | null
  card_number_masked: string | null
  pg_provider: string
  created_at: string
}

export async function getCustomerBillingKey(userId: string) {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase
    .from("customer_billing_keys")
    .select("id, user_id, card_company, card_number_masked, created_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) return { error: error.message }
  return { billingKey: data as Omit<BillingKeyRow, "billing_key" | "customer_key"> | null }
}

/** 서버에서 결제 시 사용. 본인 확인 후 billing_key만 반환 */
export async function getBillingKeyForPayment(userId: string) {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase
    .from("customer_billing_keys")
    .select("billing_key, customer_key")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data?.billing_key) return { billingKey: null, customerKey: null }
  return { billingKey: data.billing_key, customerKey: data.customer_key }
}

export async function deleteCustomerBillingKey(userId: string) {
  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.from("customer_billing_keys").delete().eq("user_id", userId)
  if (error) return { error: error.message }
  return { success: true }
}

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

const TOSS_BILLING_ISSUE_URL = "https://api.tosspayments.com/v1/billing/authorizations/issue"

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const authKey = body?.authKey as string | undefined
  const customerKey = body?.customerKey as string | undefined

  if (!authKey || !customerKey) {
    return NextResponse.json({ error: "authKey, customerKey가 필요합니다." }, { status: 400 })
  }

  if (customerKey !== user.id) {
    return NextResponse.json({ error: "고객 정보가 일치하지 않습니다." }, { status: 403 })
  }

  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: "토스 시크릿 키가 설정되지 않았습니다." }, { status: 500 })
  }

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
    return NextResponse.json(
      { error: data?.message || data?.code || "빌링키 발급에 실패했습니다." },
      { status: 400 },
    )
  }

  if (!data.billingKey) {
    return NextResponse.json({ error: "빌링키를 받지 못했습니다." }, { status: 500 })
  }

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

  if (error) {
    return NextResponse.json({ error: error.message || "저장에 실패했습니다." }, { status: 500 })
  }

  return NextResponse.json({ success: true, cardNumber: data.cardNumber })
}

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("82")) return "0" + digits.slice(2)
  return digits
}

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json()

    if (!phone || !code) {
      return NextResponse.json({ error: "전화번호와 인증번호를 입력해주세요." }, { status: 400 })
    }

    const normalized = normalizePhone(phone)

    // 유효한 코드 조회 (만료 안 된 것 중 최신)
    const { data, error } = await supabase
      .from("phone_verifications")
      .select("id, code, verified, expires_at")
      .eq("phone", normalized)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "인증번호가 만료되었거나 존재하지 않습니다." }, { status: 400 })
    }

    if (data.code !== code) {
      return NextResponse.json({ error: "인증번호가 올바르지 않습니다." }, { status: 400 })
    }

    // 인증 완료 처리
    await supabase
      .from("phone_verifications")
      .update({ verified: true })
      .eq("id", data.id)

    return NextResponse.json({ success: true, phone: normalized })
  } catch (e) {
    console.error("verify-otp error:", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

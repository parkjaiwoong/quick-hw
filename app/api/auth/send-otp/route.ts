import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { SolapiMessageService } from "solapi"

const supabase = createClient(
  process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

/** 전화번호 정규화: 숫자만 추출 후 010XXXXXXXX 형식 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("82")) return "0" + digits.slice(2)
  return digits
}

/** 6자리 랜덤 인증번호 생성 */
function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/** 솔라피 SDK로 SMS 발송 */
async function sendSmsSolapi(phone: string, code: string): Promise<{ ok: boolean; message: string }> {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const sender = process.env.SOLAPI_SENDER

  if (!apiKey || !apiSecret || !sender) {
    // 키 미설정 시 개발 모드 (콘솔 출력)
    console.log(`[OTP 개발모드] 번호: ${phone}, 코드: ${code}`)
    return { ok: true, message: "dev_mode" }
  }

  try {
    const messageService = new SolapiMessageService(apiKey, apiSecret)
    await messageService.sendOne({
      to: phone,
      from: sender,
      text: `[퀵HW언넌] 인증번호 [${code}] 를 입력해주세요. (5분 이내 유효)`,
    })
    return { ok: true, message: "sent" }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "SMS 발송 실패"
    console.error("솔라피 SMS 발송 오류:", msg)
    return { ok: false, message: msg }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: "전화번호를 입력해주세요." }, { status: 400 })
    }

    const normalized = normalizePhone(phone)

    // 010으로 시작하는 11자리 번호 검증
    if (!/^01[0-9]{8,9}$/.test(normalized)) {
      return NextResponse.json({ error: "올바른 전화번호를 입력해주세요." }, { status: 400 })
    }

    // 1분 이내 재발송 방지
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const { data: recent } = await supabase
      .from("phone_verifications")
      .select("created_at")
      .eq("phone", normalized)
      .gte("created_at", oneMinuteAgo)
      .limit(1)

    if (recent && recent.length > 0) {
      return NextResponse.json({ error: "1분 후 다시 시도해주세요." }, { status: 429 })
    }

    // 6자리 랜덤 인증번호 생성
    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5분 유효

    // DB 저장
    const { error: dbError } = await supabase.from("phone_verifications").insert({
      phone: normalized,
      code,
      expires_at: expiresAt,
    })

    if (dbError) {
      console.error("phone_verifications insert error:", dbError)
      return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
    }

    // SMS 발송
    const smsResult = await sendSmsSolapi(normalized, code)
    if (!smsResult.ok) {
      return NextResponse.json({ error: smsResult.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("send-otp error:", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.warn("[fcm-token] 401: 인증 없음 (WebView에서 기사 로그인 후 다시 시도)")
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const token = body?.token as string | undefined
  if (!token || typeof token !== "string") {
    console.warn("[fcm-token] 400: token 없음")
    return NextResponse.json({ error: "token 필요" }, { status: 400 })
  }

  const { error } = await supabase.from("driver_fcm_tokens").upsert(
    {
      user_id: user.id,
      token,
      platform: "android",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )

  if (error) {
    console.error("[fcm-token] driver_fcm_tokens upsert error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const tokenSuffix = token.length >= 24 ? token.slice(-24) : token
  console.log("[fcm-token] 등록 완료 user_id=" + user.id + " token 끝 24자(DB 대조용): " + tokenSuffix)
  console.log("[fcm-token] DB 업데이트됨 — 앱 로그의 'FCM 토큰 끝 24자'와 위 값이 일치하면 정상 반영된 것입니다.")
  return NextResponse.json({ success: true, token끝24자: tokenSuffix })
}

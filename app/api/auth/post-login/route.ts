import { NextResponse } from "next/server"
import { confirmReferralFromCookie } from "@/lib/actions/rider-referral"

/** 클라이언트 로그인 후 고객 추천 귀속 등 서버 쿠키 작업 (비동기 호출용) */
export async function POST() {
  try {
    await confirmReferralFromCookie()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("post-login error:", e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

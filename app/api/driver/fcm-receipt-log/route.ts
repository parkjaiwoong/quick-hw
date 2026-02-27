import { NextResponse } from "next/server"

/** FCM 수신 로그 API — 테스트용 로그 테이블 제거로 비활성화 */
export async function POST() {
  return NextResponse.json({ success: true })
}

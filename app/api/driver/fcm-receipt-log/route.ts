import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const getServiceSupabase = () => {
  const url = process.env.NEXT_PUBLIC_QUICKSUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/** 기사 앱에서 FCM 수신 시 즉시 호출해 DB에 로그 저장. 수신 여부 확인용 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const driverId = body?.driver_id ?? body?.driverId
    const deliveryId = body?.delivery_id ?? body?.deliveryId ?? null
    const source = body?.source ?? "unknown" // foreground | background | native
    const rawData = body?.raw_data ?? body ?? {}

    if (!driverId) {
      return NextResponse.json({ error: "driver_id 필요" }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    if (!supabase) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 })
    }

    const { error } = await supabase.from("fcm_receipt_log").insert({
      driver_id: driverId,
      delivery_id: deliveryId || null,
      source,
      raw_data: typeof rawData === "object" ? rawData : {},
    })

    if (error) {
      console.error("[fcm-receipt-log] INSERT 실패:", error.message, { driverId, deliveryId, source })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[fcm-receipt-log] 저장 완료", { driverId, deliveryId, source })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[fcm-receipt-log] 오류:", (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

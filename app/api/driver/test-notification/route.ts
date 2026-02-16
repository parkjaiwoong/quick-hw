import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

/** 개발 환경에서만: 현재 기사에게 테스트 알림 1건 INSERT → Realtime으로 UI/진동/소리 테스트용 */
export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "개발 환경에서만 사용 가능합니다." }, { status: 403 })
  }

  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "서비스 키 없음" }, { status: 500 })
  }

  const { createClient } = await import("@supabase/supabase-js")
  const service = createClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: oneDelivery } = await service
    .from("deliveries")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const deliveryId = oneDelivery?.id ?? "00000000-0000-0000-0000-000000000000"

  const { error } = await service.from("notifications").insert({
    user_id: user.id,
    delivery_id: deliveryId,
    title: "테스트 알림 (개발)",
    message: "UI/진동/소리 확인용입니다.",
    type: "new_delivery_request",
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

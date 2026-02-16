import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const token = body?.token as string | undefined
  if (!token || typeof token !== "string") {
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
    console.error("driver_fcm_tokens upsert error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

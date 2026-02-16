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
  const subscription = body?.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "subscription(endpoint, keys.p256dh, keys.auth)가 필요합니다." }, { status: 400 })
  }

  const userAgent = request.headers.get("user-agent") ?? undefined

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
    },
    { onConflict: "endpoint" }
  )

  if (error) {
    console.error("push_subscriptions upsert error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

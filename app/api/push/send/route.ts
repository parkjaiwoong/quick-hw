import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

const getServiceSupabase = () => {
  const url = process.env.NEXT_PUBLIC_QUICKSUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(request: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET
  const authHeader = request.headers.get("authorization")
  const webhookSecret = request.headers.get("x-webhook-secret")
  const isValid =
    (secret && authHeader === `Bearer ${secret}`) || (secret && webhookSecret === secret)

  if (!secret || !isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  // Supabase Database Webhook 형식: { type, table, record: { user_id, title, message, type, delivery_id } }
  const record = body?.record ?? body
  const userId = (record?.user_id ?? body?.user_id) as string | undefined
  const title = (record?.title ?? body?.title as string) || "새 배송 요청"
  const message = (record?.message ?? body?.message as string) || "배송 요청이 도착했습니다."
  const url = (body?.url as string) || "/driver"
  const notifType = (record?.type ?? body?.type) as string | undefined
  const deliveryId = (record?.delivery_id ?? body?.delivery_id) as string | undefined

  if (!userId) {
    return NextResponse.json({ error: "user_id 필요" }, { status: 400 })
  }
  // 배송 요청 알림만 푸시 전송 (다른 타입은 생략 가능)
  if (notifType && notifType !== "new_delivery_request" && notifType !== "new_delivery") {
    return NextResponse.json({ success: true, skipped: "type" })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 })
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://quick-hw.vercel.app"
  const openUrl = deliveryId ? `${baseUrl}/driver/delivery/${deliveryId}` : `${baseUrl}${url}`

  const payload = JSON.stringify({
    title,
    body: message,
    url: openUrl,
  })

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails("mailto:support@example.com", vapidPublic, vapidPrivate)
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)

  const results: { webPush: { ok: number; failed: number }; fcm?: string } = { webPush: { ok: 0, failed: 0 } }
  if (subs && subs.length > 0 && vapidPublic && vapidPrivate) {
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 }
        )
        results.webPush.ok++
      } catch (e) {
        results.webPush.failed++
        if ((e as { statusCode?: number })?.statusCode === 410 || (e as { statusCode?: number })?.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id)
        }
      }
    }
  }

  // FCM (Flutter 기사 앱) 전송
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (serviceAccountJson) {
    try {
      const { getMessaging } = await import("firebase-admin/messaging")
      const { getApps, initializeApp, cert } = await import("firebase-admin/app")
      if (getApps().length === 0) {
        const jsonStr = serviceAccountJson.replace(/\\n/g, "\n")
        const cred = JSON.parse(jsonStr)
        initializeApp({ credential: cert(cred) })
      }
      const { data: tokens } = await supabase
        .from("driver_fcm_tokens")
        .select("token")
        .eq("user_id", userId)
      if (tokens && tokens.length > 0) {
        const messaging = getMessaging()
        const res = await messaging.sendEachForMulticast({
          tokens: tokens.map((r) => r.token),
          notification: { title, body: message },
          data: { url: openUrl, delivery_id: deliveryId || "" },
          android: { priority: "high" as const },
        })
        results.fcm = `success=${res.successCount} failure=${res.failureCount}`
      }
    } catch (e) {
      results.fcm = `error: ${(e as Error).message}`
    }
  }

  return NextResponse.json({ success: true, ...results })
}

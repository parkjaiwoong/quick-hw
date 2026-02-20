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

  // 웹훅 호출인지 서버 직접 호출인지 구분 (Supabase는 type/table 포함, 서버 직접 호출은 record만)
  const source =
    body?.type === "INSERT" && body?.table === "notifications" ? "webhook" : "server"
  console.log("[push/send] 요청 수신", { source, userId, deliveryId, notifType })

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
      console.log("[push/send] FCM 토큰 조회", { userId, tokenCount: tokens?.length ?? 0 })
      if (tokens && tokens.length > 0) {
        const messaging = getMessaging()
        const tokenList = tokens.map((r) => r.token)
        // 기사 앱: notification 없이 data만 전송해야 백그라운드/종료 시 onMessageReceived 호출됨 (오버레이·Full Screen Intent 동작)
        const res = await messaging.sendEachForMulticast({
          tokens: tokenList,
          data: {
            type: notifType || "new_delivery_request",
            delivery_id: deliveryId || "",
            driver_id: userId, // 수신 확인 로그용 (앱에서 DB 저장)
            title,
            body: message,
            url: openUrl,
          },
          android: {
            priority: "high" as const,
          },
        })
        results.fcm = `success=${res.successCount} failure=${res.failureCount}`
        console.log("[push/send] FCM 발송 결과", { userId, deliveryId, successCount: res.successCount, failureCount: res.failureCount })

        if (res.successCount > 0) {
          const successTokens = (res.responses ?? [])
            .map((r, i) => (r.success ? tokenList[i]?.slice(-24) : null))
            .filter(Boolean) as string[]
          console.log("[push/send] Successfully sent message", { userId, successCount: res.successCount, token끝24자: successTokens })
        }
        if (res.failureCount > 0 && res.responses?.length) {
          const invalidCodes = ["unregistered", "registration-token-not-registered", "invalid-argument", "invalid-registration-token"]
          for (let i = 0; i < res.responses.length; i++) {
            const r = res.responses[i]
            if (r.success) continue
            const err = r.error as { code?: string; message?: string } | undefined
            const code = err?.code ?? "unknown"
            const msg = err?.message ?? String(err)
            const tokenSuffix = tokenList[i]?.slice(-24) ?? "?"
            console.error("[push/send] FCM 토큰별 실패", { userId, index: i, code, message: msg, token끝24자: tokenSuffix })
            if (invalidCodes.some((c) => code?.toLowerCase().includes(c))) {
              const deadToken = tokenList[i]
              if (deadToken) {
                const { error: delErr } = await supabase.from("driver_fcm_tokens").delete().eq("user_id", userId).eq("token", deadToken)
                if (delErr) console.error("[push/send] FCM 무효 토큰 DB 삭제 실패", { userId, error: delErr.message })
                else console.log("[push/send] FCM 무효 토큰 DB에서 삭제", { userId, token끝24자: tokenSuffix })
              }
            }
          }
        }
      } else {
        console.log("[push/send] FCM 토큰 없음 — 전송 생략", { userId })
      }
    } catch (e) {
      results.fcm = `error: ${(e as Error).message}`
      console.error("[push/send] FCM 오류", { userId, deliveryId, error: (e as Error).message })
    }
  }

  return NextResponse.json({ success: true, ...results })
}

import { NextRequest, NextResponse } from "next/server"
import { updateDeliveryStatus, completeDeliveryFromAccepted } from "@/lib/actions/driver"
import { getSupabaseServerClient, createServerClientWithJwt } from "@/lib/supabase/server"

/**
 * POST /api/driver/delivery/[id]/status
 * FormData: status (picked_up | in_transit | delivered)
 * 인증: 쿠키(웹) 또는 Authorization: Bearer <access_token>(앱/WebView)
 * WebView/앱에서 쿠키가 없을 때 Bearer 토큰으로 호출하면 DB 업데이트가 정상 반영됨.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deliveryId } = await params
    if (!deliveryId) {
      return NextResponse.json({ error: "delivery id required" }, { status: 400 })
    }

    const formData = await req.formData()
    const status = String(formData.get("status") || "")
    if (!["picked_up", "in_transit", "delivered"].includes(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 })
    }
    const deliveryProofUrl = String(formData.get("delivery_proof_url") || "").trim() || undefined
    const fromAccepted = formData.get("from_accepted") === "1"

    // 앱/WebView: Bearer 토큰이 있으면 해당 세션으로 업데이트 (쿠키 없어도 동작)
    const authHeader = req.headers.get("authorization")
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
    const supabaseForUpdate =
      bearerToken ? createServerClientWithJwt(bearerToken) : await getSupabaseServerClient()

    let result: { error?: string } | { success?: boolean }
    if (status === "delivered" && fromAccepted) {
      result = await completeDeliveryFromAccepted(deliveryId, deliveryProofUrl, supabaseForUpdate)
    } else {
      result = await updateDeliveryStatus(deliveryId, status, deliveryProofUrl, supabaseForUpdate)
    }
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const wantsJson = req.headers.get("accept")?.includes("application/json")
    if (wantsJson) {
      return NextResponse.json({ success: true })
    }

    let redirectUrl: URL
    if (status === "delivered") {
      const supabase = await getSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: nextRows } = await supabase
          .from("deliveries")
          .select("id")
          .eq("driver_id", user.id)
          .in("status", ["accepted", "picked_up", "in_transit"])
          .neq("id", deliveryId)
          .order("accepted_at", { ascending: false })
          .limit(1)
        const nextId = nextRows?.[0]?.id
        if (nextId) {
          redirectUrl = new URL(`/driver/delivery/${nextId}`, req.url)
        } else {
          redirectUrl = new URL("/driver", req.url)
        }
      } else {
        redirectUrl = new URL("/driver", req.url)
      }
    } else {
      redirectUrl = new URL(`/driver/delivery/${deliveryId}`, req.url)
    }

    return NextResponse.redirect(redirectUrl, 302)
  } catch (e) {
    console.error("driver delivery status update error:", e)
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

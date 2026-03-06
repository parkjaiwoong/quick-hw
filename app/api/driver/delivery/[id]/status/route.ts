import { NextRequest, NextResponse } from "next/server"
import { updateDeliveryStatus } from "@/lib/actions/driver"

/**
 * POST /api/driver/delivery/[id]/status
 * FormData: status (picked_up | in_transit | delivered)
 * WebView에서 form submit + redirect로 픽업/배송 완료 처리 (JS server action 대신)
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

    const result = await updateDeliveryStatus(deliveryId, status, deliveryProofUrl)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const wantsJson = req.headers.get("accept")?.includes("application/json")
    if (wantsJson) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.redirect(
      new URL(`/driver/delivery/${deliveryId}`, req.url),
      302
    )
  } catch (e) {
    console.error("driver delivery status update error:", e)
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

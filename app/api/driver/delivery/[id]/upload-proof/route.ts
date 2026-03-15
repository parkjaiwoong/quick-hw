import { NextRequest, NextResponse } from "next/server"
import { uploadDeliveryProof, uploadDeliveryProofFromBase64 } from "@/lib/actions/driver"

/**
 * POST /api/driver/delivery/[id]/upload-proof
 * - FormData: file (image)
 * - JSON: { dataUrl: "data:image/png;base64,..." } — WebView FormData 이슈 회피용
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

    const contentType = req.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const body = await req.json()
      const dataUrl = body?.dataUrl
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
        return NextResponse.json({ error: "dataUrl 형식이 올바르지 않습니다." }, { status: 400 })
      }
      const result = await uploadDeliveryProofFromBase64(deliveryId, dataUrl)
      if (result?.error) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true, url: result.url })
    }

    const formData = await req.formData()
    const result = await uploadDeliveryProof(deliveryId, formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, url: result.url })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error("upload delivery proof error:", err)
    const message = err.message && !err.message.includes("fetch") ? err.message : "업로드에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

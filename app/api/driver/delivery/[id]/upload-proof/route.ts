import { NextRequest, NextResponse } from "next/server"
import { uploadDeliveryProof } from "@/lib/actions/driver"

/**
 * POST /api/driver/delivery/[id]/upload-proof
 * FormData: file (image)
 * WebView에서 form POST로 사진 업로드 (server action 대신)
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
    const result = await uploadDeliveryProof(deliveryId, formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, url: result.url })
  } catch (e) {
    console.error("upload delivery proof error:", e)
    return NextResponse.json(
      { error: "업로드에 실패했습니다." },
      { status: 500 }
    )
  }
}

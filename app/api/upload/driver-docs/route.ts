import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const docType = formData.get("docType") as string | null // "license" | "vehicle"
    const tempId = formData.get("tempId") as string | null  // 가입 전 임시 식별자 (phone)

    if (!file || !docType || !tempId) {
      return NextResponse.json({ error: "파일, 문서 유형, 식별자가 필요합니다." }, { status: 400 })
    }

    if (!["license", "vehicle"].includes(docType)) {
      return NextResponse.json({ error: "docType은 license 또는 vehicle이어야 합니다." }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "JPG, PNG, WEBP, HEIC 형식만 업로드 가능합니다." }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 })
    }

    const ext = file.name.split(".").pop() || "jpg"
    const safeTempId = tempId.replace(/\D/g, "")
    const path = `temp/${safeTempId}/${docType}_${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from("driver-docs")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return NextResponse.json({ error: "파일 업로드에 실패했습니다." }, { status: 500 })
    }

    // 서명된 URL 생성 (1시간 유효 — 가입 완료 후 driver_info에 저장됨)
    const { data: signedData } = await supabase.storage
      .from("driver-docs")
      .createSignedUrl(path, 3600)

    return NextResponse.json({
      success: true,
      path,
      signedUrl: signedData?.signedUrl,
    })
  } catch (e) {
    console.error("driver-docs upload error:", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

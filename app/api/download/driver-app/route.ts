import { NextResponse } from "next/server"
import { createReadStream, existsSync, statSync } from "fs"
import { Readable } from "stream"
import path from "path"

const APK_PATH = path.join(process.cwd(), "public", "downloads", "driver-app.apk")

export async function GET() {
  if (!existsSync(APK_PATH)) {
    return NextResponse.json(
      { error: "APK 파일이 아직 배포되지 않았습니다. public/downloads/driver-app.apk 를 추가한 뒤 다시 시도해 주세요." },
      { status: 404 }
    )
  }

  const size = statSync(APK_PATH).size
  const nodeStream = createReadStream(APK_PATH)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="driver-app.apk"',
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=3600",
    },
  })
}

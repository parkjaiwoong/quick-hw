import { NextResponse } from "next/server"

/**
 * 기사 앱(Flutter) 버전 체크용.
 * 앱 실행 시 이 API를 호출해 최신 버전·다운로드 URL을 받고, 필요 시 업데이트 안내.
 * 환경 변수(선택):
 *   NEXT_PUBLIC_DRIVER_APP_MIN_VERSION  - 필수 최소 버전 (미만이면 업데이트 필수)
 *   NEXT_PUBLIC_DRIVER_APP_LATEST_VERSION - 최신 버전 (앱에서 비교용)
 *   NEXT_PUBLIC_DRIVER_APP_DOWNLOAD_URL   - 새 APK 다운로드 URL (또는 스토어 링크)
 */
export async function GET() {
  const minVersion = process.env.NEXT_PUBLIC_DRIVER_APP_MIN_VERSION ?? null
  const latestVersion = process.env.NEXT_PUBLIC_DRIVER_APP_LATEST_VERSION ?? process.env.NEXT_PUBLIC_DRIVER_APP_MIN_VERSION ?? null
  const downloadUrl =
    process.env.NEXT_PUBLIC_DRIVER_APP_DOWNLOAD_URL ?? null

  return NextResponse.json({
    minVersion: minVersion ?? undefined,
    latestVersion: latestVersion ?? undefined,
    downloadUrl: downloadUrl ?? undefined,
  })
}

import { redirect } from "next/navigation"

/** 구 경로 → 새 경로로 영구 리다이렉트 */
export default function OldDriverAppDownloadPage() {
  redirect("/app-download")
}

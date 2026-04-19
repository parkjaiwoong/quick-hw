"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Smartphone } from "lucide-react"

/** 앱(WebView) 내에서는 숨김, 웹 브라우저에서만 표시 */
export function AppDownloadButton() {
  // false로 시작 → 웹에서 기본 표시, 앱 UA 감지 시 숨김
  const [isApp, setIsApp] = useState(false)

  useEffect(() => {
    if (navigator.userAgent.includes("QuickHWDriverApp")) {
      setIsApp(true)
    }
  }, [])

  if (isApp) return null

  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className="h-12 rounded-full border-[#E5E8EB] bg-white px-6 text-sm font-semibold text-[#191F28] shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:bg-[#F8F9FA]"
    >
      <Link href="/app-download" className="flex items-center gap-2">
        <Smartphone className="size-4 text-[#3182F6]" strokeWidth={1.75} />
        앱 다운로드
      </Link>
    </Button>
  )
}

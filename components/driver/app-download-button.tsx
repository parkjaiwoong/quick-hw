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
    <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
      <Link href="/app-download" className="flex items-center gap-1.5">
        <Smartphone className="h-4 w-4" />
        앱 다운로드
      </Link>
    </Button>
  )
}

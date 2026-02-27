"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Smartphone } from "lucide-react"

/** 기사 앱(WebView) 내에서는 숨김, 웹 브라우저에서만 표시 */
export function AppDownloadButton() {
  const [isApp, setIsApp] = useState(true) // 깜빡임 방지: 기본 숨김

  useEffect(() => {
    setIsApp(navigator.userAgent.includes("QuickHWDriverApp"))
  }, [])

  if (isApp) return null

  return (
    <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
      <Link href="/driver/app-download" className="flex items-center gap-1.5">
        <Smartphone className="h-4 w-4" />
        기사 앱 다운로드
      </Link>
    </Button>
  )
}

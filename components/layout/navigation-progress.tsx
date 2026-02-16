"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"

/**
 * 내부 링크 클릭 시 상단에 얇은 로딩 바를 표시해 체감 속도를 높입니다.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const prevPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (prevPathRef.current !== null && prevPathRef.current !== pathname) {
      setVisible(false)
    }
    prevPathRef.current = pathname
  }, [pathname])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const anchor = target.closest("a")
      if (!anchor || anchor.target === "_blank" || !anchor.href) return
      try {
        const url = new URL(anchor.href)
        if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
          setVisible(true)
        }
      } catch {
        // ignore
      }
    }
    document.documentElement.addEventListener("click", handleClick, true)
    return () => document.documentElement.removeEventListener("click", handleClick, true)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed left-0 top-0 z-[9999] h-0.5 w-full overflow-hidden bg-primary/80"
      role="progressbar"
      aria-valuenow={null}
      aria-label="페이지 이동 중"
    >
      <div
        className="h-full w-1/3 rounded-full bg-primary shadow-sm"
        style={{
          animation: "navigation-progress 1.2s ease-in-out infinite",
        }}
      />
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** 지도 숨김 상태일 때 높이 0 (완전히 안 보이도록) */
const MIN_MAP_PX = 0
const MAX_MAP_VH = 95
const DEFAULT_MAP_VH = 45
const DESKTOP_MAP_HEIGHT = 224
/** 모바일 하단 고정 버튼 + 핸들 위로 지도가 가리지 않도록 - 최소한만 확보해서 지도가 더 넓게 보이도록 */
const RESERVED_BOTTOM_PX = 120

interface DriverDeliveryResizableProps {
  mapNode: React.ReactNode
  children: React.ReactNode
}

/**
 * 모바일: 콘텐츠(출발지, 배송옵션, 물품정보 등) 기준 리사이즈.
 * 핸들을 아래→위로 올리면 지도가 숨겨지고 데이터만 보임.
 * 위→아래로 내리면 지도가 전체로 보임.
 */
export function DriverDeliveryResizable({ mapNode, children }: DriverDeliveryResizableProps) {
  const [mapHeightPx, setMapHeightPx] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(true)
  const dragStartYRef = useRef(0)
  const dragStartHeightRef = useRef(0)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    setMapHeightPx(Math.round((window.innerHeight * DEFAULT_MAP_VH) / 100))
  }, [])

  useEffect(() => {
    return () => {
      document.body.style.touchAction = ""
      document.body.style.userSelect = ""
    }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const y = "touches" in e ? e.touches[0]?.clientY : e.clientY
      if (y == null) return
      dragStartYRef.current = y
      dragStartHeightRef.current =
        mapHeightPx ?? Math.round((window.innerHeight * DEFAULT_MAP_VH) / 100)

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const yy = "touches" in ev ? ev.touches[0]?.clientY : ev.clientY
        if (yy == null) return
        const rawMax = Math.round((window.innerHeight * MAX_MAP_VH) / 100)
        const maxPx = Math.min(rawMax, window.innerHeight - RESERVED_BOTTOM_PX)
        const next = Math.max(
          MIN_MAP_PX,
          Math.min(maxPx, dragStartHeightRef.current + delta)
        )
        setMapHeightPx(next)
      }
      const cleanup = () => {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", cleanup)
        document.removeEventListener("touchmove", onMove, { passive: true })
        document.removeEventListener("touchend", cleanup)
        document.removeEventListener("touchcancel", cleanup)
        document.body.style.touchAction = ""
        document.body.style.userSelect = ""
      }
      document.body.style.touchAction = "none"
      document.body.style.userSelect = "none"
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", cleanup)
      document.addEventListener("touchmove", onMove, { passive: true })
      document.addEventListener("touchend", cleanup)
      document.addEventListener("touchcancel", cleanup)
    },
    [mapHeightPx]
  )

  const handleDoubleClick = useCallback(() => {
    setMapHeightPx((prev) => {
      if (typeof window === "undefined") return MIN_MAP_PX
      const rawMax = Math.round((window.innerHeight * MAX_MAP_VH) / 100)
      const maxPx = Math.min(rawMax, window.innerHeight - RESERVED_BOTTOM_PX)
      if (prev == null || prev <= MIN_MAP_PX) return maxPx
      return MIN_MAP_PX
    })
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      {/* 지도: 모바일에서 높이 가변, 데스크톱에서 고정 */}
      <div
        className="overflow-hidden flex-shrink-0 border-b border-slate-200 bg-slate-50 md:min-h-0 md:rounded-xl md:border md:mx-4 md:mt-4 md:shadow-sm"
        style={
          isMobile
            ? {
                height:
                  mapHeightPx != null
                    ? `${Math.max(MIN_MAP_PX, mapHeightPx)}px`
                    : "45vh",
                minHeight: MIN_MAP_PX,
              }
            : { height: DESKTOP_MAP_HEIGHT }
        }
      >
        {mapNode}
      </div>

      {/* 리사이즈 핸들: 콘텐츠 상단, 지도 바로 아래 (모바일 전용) - z-30으로 액션 버튼 위에 표시 */}
      <div
        role="button"
        tabIndex={0}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        className="relative z-30 flex shrink-0 cursor-grab active:cursor-grabbing justify-center py-3 bg-slate-100 hover:bg-slate-200 border-y-2 border-slate-300 min-h-[44px] touch-manipulation select-none md:hidden"
        aria-label="드래그 위로: 지도 숨김, 아래로: 지도 전체"
      >
        <span className="w-14 h-1.5 rounded-full bg-slate-500 block" />
      </div>

      {/* 콘텐츠: 출발지, 배송옵션, 픽업/배송 정보, 물품 정보 등 */}
      <div className="flex-1 overflow-auto min-h-0">
        {children}
      </div>
    </div>
  )
}

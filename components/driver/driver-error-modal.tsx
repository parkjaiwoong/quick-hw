"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { createClient } from "@/lib/supabase/client"

const STORAGE_KEY_ERROR = "driver_오류4내용"
const STORAGE_KEY_NEW = "driver_신규내용"
const DRIVER_NEW_DELIVERY_EVENT = "driver-new-delivery-request"
const MAX_NEW = 30

function getStored(key: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function setStored(key: string, value: string[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

interface DriverErrorModalProps {
  userId: string
  isAvailable: boolean
}

export function DriverErrorModal({ userId, isAvailable }: DriverErrorModalProps) {
  const [오류4, set오류4] = useState<string[]>([])
  const [신규, set신규] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  const loadFromStorage = useCallback(() => {
    set오류4(getStored(STORAGE_KEY_ERROR))
    set신규(getStored(STORAGE_KEY_NEW))
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    loadFromStorage()
  }, [mounted, loadFromStorage])

  // 배송가능 시 마운트될 때 이미 있는 미확인 신규 요청을 신규내용에 반영 (realtime/폴링 이벤트 놓친 경우)
  useEffect(() => {
    if (!mounted || !isAvailable || !userId) return
    const supabase = createClient()
    supabase
      .from("notifications")
      .select("id, delivery_id, created_at")
      .eq("user_id", userId)
      .eq("is_read", false)
      .in("type", ["new_delivery_request", "new_delivery"])
      .not("delivery_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data: rows }) => {
        if (!rows?.length) return
        const prev = getStored(STORAGE_KEY_NEW)
        const newLines = rows.map(
          (r) => `${new Date(r.created_at).toLocaleTimeString("ko-KR")} 신규 배송 요청 (${r.delivery_id?.slice(0, 8) ?? ""})`
        )
        const merged = [...newLines, ...prev.filter((l) => !newLines.some((n) => l === n))]
        const next = merged.slice(0, MAX_NEW)
        setStored(STORAGE_KEY_NEW, next)
        set신규(next)
      })
      .catch(() => {})
  }, [mounted, isAvailable, userId])

  useEffect(() => {
    if (!mounted || !isAvailable) return
    const handler = () => {
      const prev = getStored(STORAGE_KEY_NEW)
      const line = `${new Date().toLocaleTimeString("ko-KR")} 신규 배송 요청`
      const next = [...prev, line].slice(-MAX_NEW)
      setStored(STORAGE_KEY_NEW, next)
      set신규(next)
    }
    window.addEventListener(DRIVER_NEW_DELIVERY_EVENT, handler)
    return () => window.removeEventListener(DRIVER_NEW_DELIVERY_EVENT, handler)
  }, [mounted, isAvailable])

  const clear오류4 = () => {
    set오류4([])
    setStored(STORAGE_KEY_ERROR, [])
  }
  const clear신규 = () => {
    set신규([])
    setStored(STORAGE_KEY_NEW, [])
  }

  if (!mounted || !isAvailable) return null

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-4"
      aria-modal
      role="dialog"
    >
      {/* 백그라운드 반투명 */}
      <div className="absolute inset-0 bg-black/40" />
      {/* 제일 상단 백그라운드 모달 */}
      <div className="relative z-10 w-[min(320px,90vw)] max-h-[70vh] overflow-hidden rounded-xl border-2 border-amber-500 bg-gray-900 shadow-2xl">
        <div className="border-b border-white/20 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">오류4내용 =&gt; {오류4.length ? `${오류4.length}건` : "없음"}</span>
            <button
              type="button"
              onClick={clear오류4}
              className="rounded px-2 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              비우기
            </button>
          </div>
        </div>
        <div className="max-h-[28vh] overflow-y-auto p-3 text-xs text-white/80">
          {오류4.length === 0 ? (
            <p className="text-center text-white/50">오류 없음 (앱에서 표시됨)</p>
          ) : (
            오류4.map((line, i) => (
              <p key={i} className="mb-1.5 break-words">
                {line}
              </p>
            ))
          )}
        </div>
        <div className="border-t border-white/20 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">신규내용 =&gt; {신규.length ? `${신규.length}건` : "없음"}</span>
            <button
              type="button"
              onClick={clear신규}
              className="rounded px-2 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              비우기
            </button>
          </div>
        </div>
        <div className="max-h-[28vh] overflow-y-auto p-3 text-xs text-white/80">
          {신규.length === 0 ? (
            <p className="text-center text-white/50">신규 없음</p>
          ) : (
            신규.map((line, i) => (
              <p key={i} className="mb-1.5 break-words">
                {line}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { getMyAssignedDeliveries, getDriverUnreadNewRequests, acceptDelivery } from "@/lib/actions/driver"

const STORAGE_KEY_ERROR = "driver_오류5내용"
const STORAGE_KEY_NEW = "driver_신규내용"
const STORAGE_KEY_MODAL_DISMISSED = "driver_modal_dismissed"
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

function getModalDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_MODAL_DISMISSED) === "1"
  } catch {
    return false
  }
}

function setModalDismissed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY_MODAL_DISMISSED, value ? "1" : "0")
  } catch {}
}

interface DriverErrorModalProps {
  userId: string
  isAvailable: boolean
}

export function DriverErrorModal({ userId, isAvailable }: DriverErrorModalProps) {
  const [오류5, set오류5] = useState<string[]>([])
  const [신규, set신규] = useState<string[]>([])
  const [진행중, set진행중] = useState<{ id: string; status: string; accepted_at?: string }[]>([])
  const [modalDismissed, setModalDismissedState] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (mounted && isAvailable) {
      setModalDismissedState(getModalDismissed())
    }
  }, [mounted, isAvailable])
  const [acceptLoading, setAcceptLoading] = useState(false)
  const handle요청승낙Ref = useRef<() => Promise<void>>(async () => {})

  const loadFromStorage = useCallback(() => {
    set오류5(getStored(STORAGE_KEY_ERROR))
    set신규(getStored(STORAGE_KEY_NEW))
    setModalDismissedState(getModalDismissed())
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    loadFromStorage()
  }, [mounted, loadFromStorage])

  // DB에서 직접: 미확인 신규 요청 + 진행중 배송 이력 (가져오기 검증용)
  useEffect(() => {
    if (!mounted || !isAvailable) return
    getDriverUnreadNewRequests().then(({ notifications }) => {
      if (notifications.length) {
        const lines = notifications.map(
          (r) =>
            `${new Date(r.created_at).toLocaleTimeString("ko-KR")} 신규 배송 요청 (${r.delivery_id?.slice(0, 8) ?? ""})`
        )
        const prev = getStored(STORAGE_KEY_NEW)
        const merged = [...lines, ...prev.filter((l) => !lines.some((n) => l === n))].slice(0, MAX_NEW)
        setStored(STORAGE_KEY_NEW, merged)
        set신규(merged)
      }
    })
    getMyAssignedDeliveries().then((res) => {
      if (res.deliveries?.length) {
        set진행중(
          res.deliveries.map((d: { id: string; status: string; accepted_at?: string }) => ({
            id: d.id,
            status: d.status,
            accepted_at: d.accepted_at,
          }))
        )
      } else {
        set진행중([])
      }
    })
  }, [mounted, isAvailable])

  // 앱(Flutter)에서 "연결요청 수락" 버튼 클릭 시 WebView가 받는 이벤트 → 동일하게 수락 처리
  useEffect(() => {
    if (!mounted) return
    const handler = () => {
      handle요청승낙Ref.current?.()
    }
    window.addEventListener("driver-accept-latest-request", handler)
    return () => window.removeEventListener("driver-accept-latest-request", handler)
  }, [mounted])

  useEffect(() => {
    if (!mounted || !isAvailable) return
    const handler = () => {
      setModalDismissedState(false)
      setModalDismissed(false)
      const prev = getStored(STORAGE_KEY_NEW)
      const line = `${new Date().toLocaleTimeString("ko-KR")} 신규 배송 요청`
      const next = [...prev, line].slice(-MAX_NEW)
      setStored(STORAGE_KEY_NEW, next)
      set신규(next)
    }
    window.addEventListener(DRIVER_NEW_DELIVERY_EVENT, handler)
    return () => window.removeEventListener(DRIVER_NEW_DELIVERY_EVENT, handler)
  }, [mounted, isAvailable])

  const handle넘기기 = () => {
    setModalDismissedState(true)
    setModalDismissed(true)
  }

  const handle요청승낙 = useCallback(async () => {
    const { notifications } = await getDriverUnreadNewRequests()
    const first = notifications[0]
    if (!first?.delivery_id) {
      setModalDismissedState(true)
      setModalDismissed(true)
      return
    }
    setAcceptLoading(true)
    try {
      await acceptDelivery(first.delivery_id)
      setModalDismissedState(true)
      setModalDismissed(true)
      window.location.reload()
    } finally {
      setAcceptLoading(false)
    }
  }, [])
  handle요청승낙Ref.current = handle요청승낙

  const clear오류5 = () => {
    set오류5([])
    setStored(STORAGE_KEY_ERROR, [])
  }
  const clear신규 = () => {
    set신규([])
    setStored(STORAGE_KEY_NEW, [])
  }

  if (!mounted || !isAvailable) return null
  if (modalDismissed) return null

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-4"
      aria-modal
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex w-[min(360px,92vw)] max-h-[85vh] flex-col overflow-hidden rounded-xl border-2 border-amber-500 bg-gray-900 shadow-2xl">
        <div className="border-b border-white/20 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">오류5내용 =&gt; {오류5.length ? `${오류5.length}건` : "없음"}</span>
            <button type="button" onClick={clear오류5} className="rounded px-2 py-1 text-xs text-white/80 hover:bg-white/10">
              비우기
            </button>
          </div>
        </div>
        <div className="max-h-[20vh] overflow-y-auto p-3 text-xs text-white/80">
          {오류5.length === 0 ? (
            <p className="text-center text-white/50">오류 없음 (앱에서 표시됨)</p>
          ) : (
            오류5.map((line, i) => (
              <p key={i} className="mb-1.5 break-words">
                {line}
              </p>
            ))
          )}
        </div>

        <div className="border-t border-white/20 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">신규내용 =&gt; {신규.length ? `${신규.length}건` : "없음"}</span>
            <button type="button" onClick={clear신규} className="rounded px-2 py-1 text-xs text-white/80 hover:bg-white/10">
              비우기
            </button>
          </div>
        </div>
        <div className="max-h-[18vh] overflow-y-auto p-3 text-xs text-white/80">
          {신규.length === 0 ? (
            <p className="text-center text-white/50">신규 없음 (DB 조회 반영)</p>
          ) : (
            신규.map((line, i) => (
              <p key={i} className="mb-1.5 break-words">
                {line}
              </p>
            ))
          )}
        </div>

        <div className="border-t border-white/20 p-3">
          <span className="font-semibold text-white">진행중 배송 이력 (DB)</span>
        </div>
        <div className="max-h-[18vh] overflow-y-auto p-3 text-xs text-white/80">
          {진행중.length === 0 ? (
            <p className="text-center text-white/50">진행중 없음</p>
          ) : (
            진행중.map((d) => (
              <p key={d.id} className="mb-1.5">
                {d.id.slice(0, 8)}… {d.status} {d.accepted_at ? new Date(d.accepted_at).toLocaleTimeString("ko-KR") : ""}
              </p>
            ))
          )}
        </div>

        <div className="flex gap-2 border-t border-white/20 p-3">
          <button
            type="button"
            onClick={handle넘기기}
            className="flex-1 rounded-lg bg-white/20 py-2 text-sm font-medium text-white hover:bg-white/30"
          >
            넘기기
          </button>
          <button
            type="button"
            onClick={handle요청승낙}
            disabled={acceptLoading}
            className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-medium text-gray-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {acceptLoading ? "처리중…" : "요청승낙"}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

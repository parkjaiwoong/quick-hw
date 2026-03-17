"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface StatusUpdateButtonProps {
  deliveryId: string
  nextStatus: string
  label: string
  className?: string
}

/**
 * 픽업 완료 / 배송 완료(사진 없음) 등 status 전환 버튼.
 * fetch + Authorization Bearer 사용 (WebView/앱에서 쿠키 없어도 DB 반영되도록)
 */
export function StatusUpdateButton({
  deliveryId,
  nextStatus,
  label,
  className,
}: StatusUpdateButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    try {
      const fd = new FormData()
      fd.set("status", nextStatus)
      const headers: HeadersInit = { Accept: "application/json" }
      const { data: { session } } = await createClient().auth.getSession()
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const res = await fetch(`/api/driver/delivery/${deliveryId}/status`, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        headers,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || "처리 중 오류가 발생했습니다.")
        return
      }
      router.refresh()
    } catch {
      alert("네트워크 오류. 다시 시도해 주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <Button type="submit" disabled={isLoading} className="w-full" size="lg">
        {isLoading ? "처리 중…" : label}
      </Button>
    </form>
  )
}

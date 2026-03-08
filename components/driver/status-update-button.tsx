"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface StatusUpdateButtonProps {
  deliveryId: string
  nextStatus: string
  label: string
  className?: string
}

/**
 * 픽업 완료 / 배송 완료(사진 없음) 등 status 전환 버튼.
 * fetch로 즉시 처리 후 페이지 전환 (풀 페이지 리로드 없음)
 */
export function StatusUpdateButton({
  deliveryId,
  nextStatus,
  label,
  className,
}: StatusUpdateButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set("status", nextStatus)
      const res = await fetch(`/api/driver/delivery/${deliveryId}/status`, {
        method: "POST",
        body: fd,
        redirect: "follow",
        credentials: "same-origin",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || "처리 중 오류가 발생했습니다.")
        return
      }
      if (res.redirected && res.url) {
        const path = new URL(res.url).pathname
        router.replace(path)
      }
      router.refresh()
    } catch {
      setError("네트워크 오류. 다시 시도해 주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <Button type="submit" disabled={isLoading} className="w-full" size="lg">
        {isLoading ? "처리 중…" : label}
      </Button>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </form>
  )
}

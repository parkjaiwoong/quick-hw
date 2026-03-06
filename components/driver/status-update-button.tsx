"use client"

import { useState, startTransition } from "react"
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
 * fetch + router.refresh()로 부분 갱신 (전체 화면 리로드 없음)
 */
export function StatusUpdateButton({
  deliveryId,
  nextStatus,
  label,
  className,
}: StatusUpdateButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleClick() {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append("status", nextStatus)
      const res = await fetch(`/api/driver/delivery/${deliveryId}/status`, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data?.error || "처리 중 오류가 발생했습니다.")
        setIsLoading(false)
        return
      }
      startTransition(() => router.refresh())
    } catch {
      alert("처리 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={className}
      size="lg"
    >
      {isLoading ? "처리 중…" : label}
    </Button>
  )
}

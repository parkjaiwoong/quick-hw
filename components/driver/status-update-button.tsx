"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface StatusUpdateButtonProps {
  deliveryId: string
  nextStatus: string
  label: string
  className?: string
}

/**
 * 픽업 완료 / 배송 완료(사진 없음) 등 status 전환 버튼.
 * form submit 사용 (WebView/모바일 환경에서 fetch보다 안정적)
 */
export function StatusUpdateButton({
  deliveryId,
  nextStatus,
  label,
  className,
}: StatusUpdateButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <form
      action={`/api/driver/delivery/${deliveryId}/status`}
      method="POST"
      className={className}
      onSubmit={() => setIsLoading(true)}
    >
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" disabled={isLoading} className="w-full" size="lg">
        {isLoading ? "처리 중…" : label}
      </Button>
    </form>
  )
}

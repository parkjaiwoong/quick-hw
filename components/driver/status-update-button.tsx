"use client"

import { useState } from "react"
import { updateDeliveryStatus } from "@/lib/actions/driver"
import { Button } from "@/components/ui/button"

interface StatusUpdateButtonProps {
  deliveryId: string
  nextStatus: string
  label: string
  className?: string
}

/**
 * 픽업 완료 / 배송 완료(사진 없음) 등 status 전환 버튼.
 * WebView에서 redirect()가 동작하지 않아 window.location.href로 강제 새로고침.
 */
export function StatusUpdateButton({
  deliveryId,
  nextStatus,
  label,
  className,
}: StatusUpdateButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleClick() {
    setIsLoading(true)
    try {
      const result = await updateDeliveryStatus(deliveryId, nextStatus)
      if (result?.error) {
        alert(result.error)
        setIsLoading(false)
        return
      }
      window.location.href = `/driver/delivery/${deliveryId}`
    } catch (err) {
      alert("처리 중 오류가 발생했습니다.")
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

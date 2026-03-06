"use client"

import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"

interface StatusUpdateButtonProps {
  deliveryId: string
  nextStatus: string
  label: string
  className?: string
}

/**
 * 픽업 완료 / 배송 완료(사진 없음) 등 status 전환 버튼.
 * 네이티브 form POST + API redirect 사용 (WebView에서 JS server action이 안 될 때 대응)
 */
function SubmitBtn({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className={className}
      size="lg"
    >
      {pending ? "처리 중…" : label}
    </Button>
  )
}

export function StatusUpdateButton({
  deliveryId,
  nextStatus,
  label,
  className,
}: StatusUpdateButtonProps) {
  return (
    <form
      action={`/api/driver/delivery/${deliveryId}/status`}
      method="POST"
      className={className}
    >
      <input type="hidden" name="status" value={nextStatus} />
      <SubmitBtn label={label} className="w-full" />
    </form>
  )
}

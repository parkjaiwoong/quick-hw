"use client"

import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"

interface SubmitButtonPendingProps {
  children: React.ReactNode
  className?: string
  size?: "default" | "sm" | "lg" | "icon"
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  pendingLabel?: string
  disabled?: boolean
}

/** 폼 내부에서 사용. 서버 액션 제출 시 즉시 pending 표시로 체감 속도 개선 */
export function SubmitButtonPending({
  children,
  className,
  size = "default",
  variant,
  pendingLabel = "처리 중…",
  disabled = false,
}: SubmitButtonPendingProps) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className={className} size={size} variant={variant} disabled={pending || disabled}>
      {pending ? pendingLabel : children}
    </Button>
  )
}

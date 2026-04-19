"use client"

import { Button } from "@/components/ui/button"

export function ReferralCopyButton({ code, className }: { code: string; className?: string }) {
  return (
    <Button
      type="button"
      className={className}
      onClick={() => {
        void navigator.clipboard.writeText(code)
      }}
    >
      코드 복사하기
    </Button>
  )
}

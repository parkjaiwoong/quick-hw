"use client"

import { AllTermsButton, TermsButton } from "@/components/common/terms-modal"

/** 메인 페이지 CTA 영역의 "약관 및 정책 보기" 버튼 */
export function MainTermsButton() {
  return (
    <AllTermsButton
      label="약관 및 정책 보기"
      variant="outline"
      className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
    />
  )
}

/** 헤더의 "약관" 버튼 */
export function HeaderTermsButton() {
  return (
    <AllTermsButton
      label="약관"
      variant="ghost"
      className="hidden sm:inline-flex h-9 px-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
    />
  )
}

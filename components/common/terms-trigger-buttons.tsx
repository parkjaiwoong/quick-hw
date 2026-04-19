"use client"

import { AllTermsButton, TermsButton } from "@/components/common/terms-modal"

/** 메인 페이지 CTA 영역의 "약관 및 정책 보기" 버튼 */
export function MainTermsButton() {
  return (
    <AllTermsButton
      label="약관 및 정책 보기"
      variant="outline"
      className="inline-flex h-12 items-center justify-center rounded-full border border-[#E5E8EB] bg-white px-6 text-sm font-semibold text-[#191F28] shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-colors hover:bg-[#F8F9FA]"
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

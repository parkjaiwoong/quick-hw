"use client"

import { usePathname } from "next/navigation"
import { FileText, Shield, Mail } from "lucide-react"
import { TermsButton } from "@/components/common/terms-modal"

export function Footer() {
  const pathname = usePathname()
  const isDriverDetailPage = pathname?.startsWith("/driver/delivery/")

  if (isDriverDetailPage) {
    return null
  }

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold mb-4">서비스 안내</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <TermsButton
                  type="service"
                  label="서비스 이용약관"
                  variant="ghost"
                  className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                />
              </li>
              <li>
                <TermsButton
                  type="privacy"
                  label="개인정보 처리방침"
                  variant="ghost"
                  className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                />
              </li>
              <li>
                <TermsButton
                  type="insurance"
                  label="보험 안내"
                  variant="ghost"
                  className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                />
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">중요 안내</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>본 플랫폼은 운송 당사자가 아닌 중개 플랫폼입니다.</li>
              <li>인적 사고(상해·사망)는 기사 개인 책임입니다.</li>
              <li>물품 보상은 약관에 명시된 범위 내에서만 가능합니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">문의</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>고객 문의는 고객 대시보드에서 접수하실 수 있습니다.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© 2025 퀵HW언넌. All rights reserved.</p>
          <p className="mt-2">
            본 플랫폼은 중개 플랫폼이며, 요금은 플랫폼 요금 기준으로 자동 산정됩니다.
          </p>
        </div>
      </div>
    </footer>
  )
}


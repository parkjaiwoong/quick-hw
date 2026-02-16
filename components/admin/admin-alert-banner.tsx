"use client"

import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Banknote, Calculator, MessageSquare, Shield } from "lucide-react"

export type AdminAlertCounts = {
  pendingSettlementCount: number
  pendingPayoutCount: number
  pendingPayoutAmount: number
  unreadInquiries?: number
  openAccidents?: number
}

interface AdminAlertBannerProps {
  counts: AdminAlertCounts
  /** 알림이 하나도 없으면 배너를 숨길지 여부 */
  hideWhenZero?: boolean
}

export function AdminAlertBanner({ counts, hideWhenZero = true }: AdminAlertBannerProps) {
  const hasSettlement = (counts.pendingSettlementCount ?? 0) > 0
  const hasPayout = (counts.pendingPayoutCount ?? 0) > 0
  const hasInquiries = (counts.unreadInquiries ?? 0) > 0
  const hasAccidents = (counts.openAccidents ?? 0) > 0
  const hasAny = hasSettlement || hasPayout || hasInquiries || hasAccidents

  if (hideWhenZero && !hasAny) return null

  return (
    <Alert variant={hasAny ? "default" : "outline"} className="border-amber-200 bg-amber-50/80">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900">주요 알림</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1 text-sm text-amber-800">
          {hasSettlement && (
            <li>
              <Link
                href="/admin/settlements"
                className="inline-flex items-center gap-1.5 font-medium text-amber-900 underline hover:no-underline"
              >
                <Calculator className="h-4 w-4" />
                정산 대기 {counts.pendingSettlementCount}건
              </Link>
            </li>
          )}
          {hasPayout && (
            <li>
              <Link
                href="/admin/payouts"
                className="inline-flex items-center gap-1.5 font-medium text-amber-900 underline hover:no-underline"
              >
                <Banknote className="h-4 w-4" />
                출금 대기 {counts.pendingPayoutCount}건
                {counts.pendingPayoutAmount > 0 && (
                  <span className="text-amber-700">
                    ({counts.pendingPayoutAmount.toLocaleString()}원)
                  </span>
                )}
              </Link>
            </li>
          )}
          {hasInquiries && (
            <li>
              <Link
                href="/admin/inquiries"
                className="inline-flex items-center gap-1.5 font-medium text-amber-900 underline hover:no-underline"
              >
                <MessageSquare className="h-4 w-4" />
                미처리 문의 {counts.unreadInquiries}건
              </Link>
            </li>
          )}
          {hasAccidents && (
            <li>
              <Link
                href="/admin/accidents"
                className="inline-flex items-center gap-1.5 font-medium text-amber-900 underline hover:no-underline"
              >
                <Shield className="h-4 w-4" />
                사고 접수 {counts.openAccidents}건
              </Link>
            </li>
          )}
          {!hasAny && <li className="text-muted-foreground">대기 중인 항목이 없습니다.</li>}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

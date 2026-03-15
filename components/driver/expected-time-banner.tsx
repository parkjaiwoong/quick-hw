"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Clock, AlertTriangle } from "lucide-react"

/** 기사 배송 상세: 예상시간 기준 진행 중/초과 안내 배너 */
export function ExpectedTimeBanner({
  status,
  acceptedAt,
  expectedDeliveryMinutes,
  urgency,
}: {
  status: string
  acceptedAt: string | null
  expectedDeliveryMinutes: number | null
  urgency: string | null
}) {
  if (!acceptedAt || status === "pending" || status === "delivered") return null

  const minutes = expectedDeliveryMinutes ?? (urgency === "express" ? 30 : 180)
  const accepted = new Date(acceptedAt).getTime()
  const expectedBy = accepted + minutes * 60 * 1000
  const now = Date.now()
  const isExceeded = now > expectedBy
  const expectedByDate = new Date(expectedBy)

  return (
    <Alert variant={isExceeded ? "destructive" : "default"} className="mb-4">
      {isExceeded ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
      <AlertTitle>
        {isExceeded ? "예상 시간이 초과되었습니다" : "배송 진행 상황 확인"}
      </AlertTitle>
      <AlertDescription className="space-y-1">
        {isExceeded ? (
          <>
            <p>예상 완료 시각({expectedByDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })})을 넘겼습니다.</p>
            <p className="font-medium">가능한 빨리 배송을 완료하고 아래 [배송 완료] 버튼을 눌러 주세요.</p>
          </>
        ) : (
          <>
            <p>배송이 진행 중이신가요? 완료되면 아래 [배송 완료] 버튼을 눌러 주세요.</p>
            <p className="text-muted-foreground text-sm">
              예상 완료 시각: {expectedByDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} (수락 후 {minutes}분)
            </p>
          </>
        )}
      </AlertDescription>
    </Alert>
  )
}

/** 배송 완료 처리 시 예상시간 초과 여부 표시용 (완료 후 토스트/문구) */
export function ExceededCompleteMessage({
  acceptedAt,
  expectedDeliveryMinutes,
  urgency,
  deliveredAt,
}: {
  acceptedAt: string | null
  expectedDeliveryMinutes: number | null
  urgency: string | null
  deliveredAt: string | null
}) {
  if (!acceptedAt || !deliveredAt) return null
  const minutes = expectedDeliveryMinutes ?? (urgency === "express" ? 30 : 180)
  const expectedBy = new Date(acceptedAt).getTime() + minutes * 60 * 1000
  const delivered = new Date(deliveredAt).getTime()
  if (delivered <= expectedBy) return null
  const overMin = Math.round((delivered - expectedBy) / 60000)
  return (
    <p className="text-sm text-amber-700 flex items-center gap-1">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      예상 시간을 {overMin}분 초과하여 완료되었습니다. (관리자 화면에서 확인됩니다)
    </p>
  )
}

"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Printer, Share2, Receipt, Check } from "lucide-react"

const paymentMethodLabel: Record<string, string> = {
  card:          "카드",
  bank_transfer: "계좌이체",
  cash:          "현금",
}

const paymentStatusLabel: Record<string, string> = {
  READY:    "결제 대기",
  PENDING:  "결제 대기",
  PAID:     "결제 완료",
  FAILED:   "결제 실패",
  CANCELED: "결제 취소",
  REFUNDED: "환불 완료",
}

const deliveryStatusLabel: Record<string, string> = {
  pending:    "기사 배정 대기",
  accepted:   "수락됨",
  picked_up:  "픽업 완료",
  in_transit: "배송 중",
  delivered:  "배송 완료",
  cancelled:  "취소됨",
}

interface ReceiptData {
  deliveryId: string
  createdAt: string
  deliveredAt?: string | null
  cancelledAt?: string | null
  deliveryStatus: string

  pickupAddress: string
  pickupContactName: string
  pickupContactPhone: string

  deliveryAddress: string
  deliveryContactName: string
  deliveryContactPhone: string

  itemDescription?: string | null
  distanceKm?: number | null

  driverFee: number
  platformFee: number
  totalFee: number
  earnedPoints: number

  paymentMethod?: string | null
  paymentStatus?: string | null
  paymentAmount?: number
  paidAt?: string | null

  driverName?: string | null
}

interface ReceiptButtonProps {
  data: ReceiptData
  disabled?: boolean
  companyName?: string | null
  stampUrl?: string | null
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm text-right ${bold ? "font-bold text-base" : "font-medium"}`}>{value}</span>
    </div>
  )
}

export function ReceiptButton({ data, disabled, companyName, stampUrl }: ReceiptButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)
  const displayCompanyName = companyName ?? "퀵HW언넌"

  const isCompleted = data.deliveryStatus === "delivered"
  const isCancelled = data.deliveryStatus === "cancelled"

  // 인쇄: 영수증 영역만 새 창으로 출력
  function handlePrint() {
    const content = receiptRef.current?.innerHTML
    if (!content) return
    const win = window.open("", "_blank", "width=480,height=700")
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <title>${displayCompanyName} 배송 영수증</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-size: 13px; color: #111; padding: 24px; }
          .receipt { max-width: 360px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 16px; }
          .header h1 { font-size: 18px; font-weight: bold; }
          .header p { font-size: 11px; color: #666; margin-top: 4px; }
          .section { margin-bottom: 12px; }
          .section-title { font-size: 11px; font-weight: bold; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
          .row { display: flex; justify-content: space-between; padding: 3px 0; }
          .row .label { color: #666; }
          .row .value { font-weight: 500; text-align: right; }
          .row.total .value { font-size: 16px; font-weight: bold; }
          .divider { border: none; border-top: 1px dashed #ccc; margin: 10px 0; }
          .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 16px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="receipt">${content}</div>
      </body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  // 공유: Web Share API → 미지원 시 클립보드 복사
  async function handleShare() {
    const text = buildShareText(data, displayCompanyName)
    if (navigator.share) {
      try {
        await navigator.share({ title: `${displayCompanyName} 배송 영수증`, text })
        return
      } catch {
        // 취소 등
      }
    }
    // 클립보드 복사 fallback
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Receipt className="h-4 w-4" />
        영수증
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm w-full p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              배송 영수증
            </DialogTitle>
          </DialogHeader>

          {/* 영수증 본문 (인쇄 대상) */}
          <div className="px-6 py-4 overflow-y-auto max-h-[70vh]">
            <div ref={receiptRef}>
              {/* 헤더 */}
              <div className="header text-center mb-4">
                <div className="flex items-center justify-center gap-2">
                  <h1 className="text-lg font-bold">{displayCompanyName}</h1>
                  {stampUrl && (
                    <Image
                      src={stampUrl}
                      alt="회사 도장"
                      width={36}
                      height={36}
                      className="object-contain opacity-90"
                      unoptimized
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">배송 서비스 영수증</p>
                <p className="text-xs text-muted-foreground">
                  {isCompleted ? `배송 완료: ${formatDate(data.deliveredAt)}` :
                   isCancelled ? `취소: ${formatDate(data.cancelledAt)}` :
                   `요청일: ${formatDate(data.createdAt)}`}
                </p>
              </div>

              <Separator className="my-3" />

              {/* 배송 정보 */}
              <div className="section mb-3">
                <p className="section-title text-xs font-semibold text-muted-foreground mb-2">배송 정보</p>
                <Row label="배송 상태" value={deliveryStatusLabel[data.deliveryStatus] ?? data.deliveryStatus} />
                <Row label="거리" value={data.distanceKm != null ? `${data.distanceKm.toFixed(1)}km` : "-"} />
                {data.itemDescription && <Row label="물품" value={data.itemDescription} />}
                {data.driverName && <Row label="배송 기사" value={data.driverName} />}
              </div>

              <Separator className="my-3 border-dashed" />

              {/* 출발지 */}
              <div className="section mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">출발지</p>
                <p className="text-sm font-medium">{data.pickupAddress}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.pickupContactName} · {data.pickupContactPhone}
                </p>
              </div>

              {/* 도착지 */}
              <div className="section mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">도착지</p>
                <p className="text-sm font-medium">{data.deliveryAddress}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.deliveryContactName} · {data.deliveryContactPhone}
                </p>
              </div>

              <Separator className="my-3 border-dashed" />

              {/* 요금 구성 */}
              <div className="section mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">요금 구성</p>
                <Row label="기사 운임" value={`${data.driverFee.toLocaleString()}원`} />
                <Row label="플랫폼 수수료" value={`${data.platformFee.toLocaleString()}원`} />
                <Row label="플랫폼 이용료 (초기)" value="0원" />
                {data.earnedPoints > 0 && (
                  <Row label="포인트 적립" value={`+${data.earnedPoints.toLocaleString()}P`} />
                )}
              </div>

              <Separator className="my-3" />

              {/* 합계 */}
              <div className="flex justify-between items-center py-2">
                <span className="font-bold">합계</span>
                <span className="text-xl font-bold text-primary">{data.totalFee.toLocaleString()}원</span>
              </div>

              <Separator className="my-3 border-dashed" />

              {/* 결제 정보 */}
              <div className="section mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">결제 정보</p>
                <Row
                  label="결제 수단"
                  value={paymentMethodLabel[data.paymentMethod ?? ""] ?? data.paymentMethod ?? "-"}
                />
                <Row
                  label="결제 금액"
                  value={`${(data.paymentAmount ?? data.totalFee).toLocaleString()}원`}
                  bold
                />
                <Row
                  label="결제 상태"
                  value={paymentStatusLabel[data.paymentStatus ?? ""] ?? data.paymentStatus ?? "-"}
                />
                {data.paidAt && <Row label="결제 일시" value={formatDate(data.paidAt)} />}
              </div>

              {/* 푸터 */}
              <div className="text-center mt-4">
                <p className="text-xs text-muted-foreground">{displayCompanyName} · 빠르고 안전한 퀵배송 연결 플랫폼</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  배송번호: {data.deliveryId.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2 px-6 pb-5 pt-2 border-t">
            <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              인쇄
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  복사됨
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  공유
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function buildShareText(data: ReceiptData, companyName = "퀵HW언넌"): string {
  const lines = [
    `📦 ${companyName} 배송 영수증`,
    `배송번호: ${data.deliveryId.slice(0, 8).toUpperCase()}`,
    `상태: ${deliveryStatusLabel[data.deliveryStatus] ?? data.deliveryStatus}`,
    "",
    `출발: ${data.pickupAddress}`,
    `도착: ${data.deliveryAddress}`,
    `거리: ${data.distanceKm != null ? `${data.distanceKm.toFixed(1)}km` : "-"}`,
    "",
    `결제 수단: ${paymentMethodLabel[data.paymentMethod ?? ""] ?? data.paymentMethod ?? "-"}`,
    `결제 금액: ${(data.paymentAmount ?? data.totalFee).toLocaleString()}원`,
    `결제 상태: ${paymentStatusLabel[data.paymentStatus ?? ""] ?? data.paymentStatus ?? "-"}`,
  ]
  if (data.paidAt) lines.push(`결제 일시: ${formatDate(data.paidAt)}`)
  if (data.earnedPoints > 0) lines.push(`포인트 적립: +${data.earnedPoints.toLocaleString()}P`)
  return lines.join("\n")
}

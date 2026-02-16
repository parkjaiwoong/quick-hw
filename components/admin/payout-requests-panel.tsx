"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PayoutRow = {
  id: string
  driver_id?: string | null
  requested_amount: number
  status: string
  bank_name?: string | null
  bank_account?: string | null
  requested_at?: string | null
  notes?: string | null
  settlement_status?: string | null
  settlement_locked?: boolean | null
  payout_status?: string | null
  driver?: { full_name?: string | null; email?: string | null; phone?: string | null }
}

type SettlementRow = {
  id: string
  driver_id?: string | null
  settlement_amount?: number | null
  settlement_status?: string | null
  payment_status?: string | null
  payout_request_id?: string | null
  created_at?: string | null
}

interface PayoutRequestsPanelProps {
  payouts: PayoutRow[]
  settlementsByDriver: Record<string, SettlementRow[]>
  walletByDriver: Record<string, number>
  onApprove: (id: string) => Promise<{ error?: string } | void>
  onTransfer: (id: string) => Promise<{ error?: string } | void>
  onHold: (id: string, reason: string) => Promise<{ error?: string } | void>
  onReject: (id: string, reason: string) => Promise<{ error?: string } | void>
}

const filterOptions = [
  { value: "all", label: "전체" },
  { value: "requested", label: "요청" },
  { value: "approved", label: "승인" },
  { value: "transferred", label: "이체완료" },
  { value: "on_hold", label: "보류" },
  { value: "rejected", label: "반려" },
  { value: "failed", label: "실패" },
  { value: "canceled", label: "취소" },
]

const statusBadgeMap: Record<string, string> = {
  REQUESTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  TRANSFERRED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  ON_HOLD: "bg-orange-100 text-orange-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELED: "bg-gray-100 text-gray-700",
}

const statusLabelMap: Record<string, string> = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  TRANSFERRED: "TRANSFERRED",
  REJECTED: "REJECTED",
  ON_HOLD: "ON_HOLD",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
}

const statusLabelKo: Record<string, string> = {
  REQUESTED: "요청",
  APPROVED: "승인",
  TRANSFERRED: "이체완료",
  REJECTED: "반려",
  ON_HOLD: "보류",
  FAILED: "실패",
  CANCELED: "취소",
}

const normalizeStatus = (status?: string | null) => {
  if (status === "approved") return "APPROVED"
  if (status === "transferred" || status === "paid") return "TRANSFERRED"
  if (status === "failed") return "FAILED"
  if (status === "canceled") return "CANCELED"
  if (status === "rejected") return "REJECTED"
  if (status === "on_hold") return "ON_HOLD"
  if (status === "requested") return "REQUESTED"
  return "REQUESTED"
}

const mapSettlementStatus = (payout: PayoutRow) => {
  if (payout.settlement_status) return payout.settlement_status
  if (payout.status === "approved" || payout.status === "transferred") return "CONFIRMED"
  if (payout.status === "on_hold") return "HOLD"
  return "READY"
}

const mapPayoutStatus = (payout: PayoutRow) => {
  if (payout.payout_status) return payout.payout_status
  if (payout.status === "approved") return "WAITING"
  if (payout.status === "transferred") return "PAID_OUT"
  return "NONE"
}

export function PayoutRequestsPanel({
  payouts,
  settlementsByDriver,
  walletByDriver,
  onApprove,
  onTransfer,
  onHold,
  onReject,
}: PayoutRequestsPanelProps) {
  const [filter, setFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [detailPayout, setDetailPayout] = useState<PayoutRow | null>(null)
  const [action, setAction] = useState<{
    type: "approve" | "hold" | "reject" | "transfer"
    payout: PayoutRow
  } | null>(null)
  const [reason, setReason] = useState("")

  const filtered = useMemo(() => {
    if (filter === "all") return payouts
    return payouts.filter((p) => normalizeStatus(p.status) === filter.toUpperCase())
  }, [filter, payouts])

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
      return
    }
    setSelectedIds(filtered.map((p) => p.id))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleFilterChange = (nextFilter: string) => {
    if (nextFilter === filter) return
    startTransition(() => {
      setFilter(nextFilter)
      setSelectedIds([])
    })
  }

  const getRequestedSettlements = (payout: PayoutRow) => {
    const driverId = payout.driver_id || ""
    const settlements = settlementsByDriver[driverId] || []
    const linked = settlements.filter((s) => s.payout_request_id === payout.id)
    if (linked.length > 0) {
      return linked
    }
    const candidates = settlements
      .filter((s) => s.settlement_status === "READY" || s.settlement_status === "LOCKED")
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    let remaining = Number(payout.requested_amount || 0)
    const selected: SettlementRow[] = []
    for (const settlement of candidates) {
      if (remaining <= 0) break
      remaining -= Number(settlement.settlement_amount || 0)
      selected.push(settlement)
    }
    return selected
  }

  const getSettlementSummary = (settlements: SettlementRow[]) => {
    if (!settlements.length) return "정산 정보 없음"
    const hasLocked = settlements.some((s) => s.settlement_status === "LOCKED")
    const allPaidOut = settlements.every((s) => s.settlement_status === "PAID_OUT")
    if (allPaidOut) return "출금 완료"
    return hasLocked ? "LOCK 포함" : "모두 READY"
  }

  const hasPaymentIssue = (settlements: SettlementRow[]) => {
    return settlements.some((s) => s.payment_status === "FAILED" || s.payment_status === "CANCELED")
  }

  const canApprove = (settlements: SettlementRow[]) => {
    return (
      settlements.length > 0 &&
      settlements.every((s) => s.settlement_status === "READY") &&
      !settlements.some((s) => s.settlement_status === "LOCKED")
    )
  }

  const canTransfer = (status: string) => status === "APPROVED" || status === "FAILED"

  const handleActionConfirm = () => {
    if (!action) return
    startTransition(async () => {
      const payload = action.payout
      const actionType = action.type
      const message = reason.trim()
      if ((actionType === "hold" || actionType === "reject") && !message) {
        toast.error("사유를 입력해주세요.")
        return
      }
      const result =
        actionType === "approve"
          ? await onApprove(payload.id)
          : actionType === "transfer"
            ? await onTransfer(payload.id)
            : actionType === "hold"
              ? await onHold(payload.id, message)
              : await onReject(payload.id, message)

      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        actionType === "approve"
          ? "출금 승인 처리되었습니다."
          : actionType === "transfer"
            ? "이체 완료 처리되었습니다."
            : actionType === "hold"
              ? "출금 요청을 보류했습니다."
              : "출금 요청을 반려했습니다.",
      )
      setAction(null)
      setReason("")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange(option.value)}
              disabled={isPending}
            >
              {option.label}
            </Button>
          ))}
          {isPending && <span className="text-xs text-muted-foreground">필터 변경 중...</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleSelectAll}>
            {selectedIds.length === filtered.length && filtered.length > 0 ? "전체 해제" : "전체 선택"}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">출금 요청 내역이 없습니다</p>
      ) : (
        filtered.map((payout) => {
          const normalizedStatus = normalizeStatus(payout.status)
          const settlements = getRequestedSettlements(payout)
          const summary = getSettlementSummary(settlements)
          const paymentIssue = hasPaymentIssue(settlements)
          const payoutCount = settlements.length
          const approveEnabled = canApprove(settlements)
          const driverId = payout.driver_id || "-"
          const requestedAt = payout.requested_at
            ? new Date(payout.requested_at).toLocaleDateString("ko-KR")
            : "-"
          const transferEnabled = canTransfer(normalizedStatus)
          const mappedSettlementStatus = mapSettlementStatus(payout)
          const mappedPayoutStatus = mapPayoutStatus(payout)
          const isHold = mappedSettlementStatus === "HOLD" || payout.settlement_locked

          return (
            <div key={payout.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{payout.driver?.full_name || payout.driver?.email || "기사"}</p>
                    <span className="text-xs text-muted-foreground">ID: {driverId}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    출금 요청 금액: {Number(payout.requested_amount || 0).toLocaleString()}원
                  </p>
                  <p className="text-sm text-muted-foreground">요청 건수: 정산 {payoutCount}건</p>
                  <p className="text-sm text-muted-foreground">요청 일시: {requestedAt}</p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                  <Badge className={statusBadgeMap[normalizedStatus] || "bg-muted text-muted-foreground"}>
                    {statusLabelKo[normalizedStatus] || statusLabelMap[normalizedStatus] || normalizedStatus}
                  </Badge>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>정산 상태: {summary}</span>
                    {paymentIssue && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        결제 이상
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 text-xs text-muted-foreground">
                    <span>회계 상태: {mappedSettlementStatus}</span>
                    <span>이체 상태: {mappedPayoutStatus}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setDetailPayout(payout)}>
                  상세 보기
                </Button>
                {!isHold && normalizedStatus !== "TRANSFERRED" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setAction({ type: "approve", payout })}
                      disabled={
                        !approveEnabled ||
                        isPending ||
                        normalizedStatus !== "REQUESTED" ||
                        mappedSettlementStatus !== "READY" ||
                        payout.settlement_locked === true
                      }
                      title={!approveEnabled ? "LOCKED 정산이 포함되었거나 정산 상태가 확인되지 않았습니다." : undefined}
                    >
                      승인
                    </Button>
                    {normalizedStatus === "APPROVED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAction({ type: "transfer", payout })}
                        disabled={!transferEnabled || isPending}
                      >
                        이체 완료 처리
                      </Button>
                    )}
                    {normalizedStatus === "FAILED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAction({ type: "transfer", payout })}
                        disabled={!transferEnabled || isPending}
                      >
                        재시도
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setAction({ type: "hold", payout })} disabled={isPending}>
                      보류
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setAction({ type: "reject", payout })} disabled={isPending}>
                      반려
                    </Button>
                  </>
                )}
              </div>
              {normalizedStatus === "APPROVED" && (
                <p className="text-xs text-muted-foreground">현재 수동 이체 방식입니다.</p>
              )}

              {(normalizedStatus === "REJECTED" || normalizedStatus === "ON_HOLD") && payout.notes && (
                <p className="text-xs text-muted-foreground">사유: {payout.notes}</p>
              )}
            </div>
          )
        })
      )}

      <Dialog open={!!detailPayout} onOpenChange={(open) => !open && setDetailPayout(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>출금 요청 상세</DialogTitle>
            <DialogDescription>요청에 포함된 정산 상세를 확인하세요.</DialogDescription>
          </DialogHeader>
          {detailPayout && (() => {
            const settlements = getRequestedSettlements(detailPayout)
            const driverId = detailPayout.driver_id || ""
            const available = walletByDriver[driverId] ?? 0
            const ratio = available > 0 ? Math.round((detailPayout.requested_amount / available) * 100) : 0
            const mappedSettlementStatus = mapSettlementStatus(detailPayout)
            const mappedPayoutStatus = mapPayoutStatus(detailPayout)
            return (
              <div className="space-y-4 text-sm">
                <div className="space-y-1">
                  <p className="font-semibold">{detailPayout.driver?.full_name || detailPayout.driver?.email || "기사"}</p>
                  <p className="text-muted-foreground">요청 금액: {Number(detailPayout.requested_amount || 0).toLocaleString()}원</p>
                  <p className="text-muted-foreground">
                    출금 가능 금액 대비 비율: {available > 0 ? `${ratio}%` : "-"}
                  </p>
                  <p className="text-muted-foreground">회계 상태: {mappedSettlementStatus}</p>
                  <p className="text-muted-foreground">이체 상태: {mappedPayoutStatus}</p>
                </div>
                <div className="space-y-2">
                  {settlements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">정산 내역이 없습니다.</p>
                  ) : (
                    settlements.map((settlement) => {
                      const isWarning =
                        settlement.settlement_status === "LOCKED" ||
                        settlement.payment_status === "FAILED" ||
                        settlement.payment_status === "CANCELED"
                      return (
                        <div
                          key={settlement.id}
                          className={`rounded border p-3 ${isWarning ? "border-red-200 bg-red-50/50" : "border-muted"}`}
                        >
                          <div className="flex justify-between text-xs">
                            <span>정산 ID: {settlement.id}</span>
                            <span>금액: {Number(settlement.settlement_amount || 0).toLocaleString()}원</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            결제 상태: {settlement.payment_status || "-"} | 정산 상태: {settlement.settlement_status || "-"}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailPayout(null)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!action} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.type === "approve"
                ? "출금 승인"
                : action?.type === "transfer"
                  ? "이체 완료 처리"
                  : action?.type === "hold"
                    ? "출금 보류"
                    : "출금 반려"}
            </DialogTitle>
            <DialogDescription>
              {action?.type === "approve"
                ? "출금 승인 후 취소할 수 없습니다."
                : action?.type === "transfer"
                  ? "실제 계좌이체가 완료되었습니까?"
                  : "사유를 입력해주세요."}
            </DialogDescription>
          </DialogHeader>
          {(action?.type === "hold" || action?.type === "reject") && (
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="사유를 입력하세요"
              rows={3}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={isPending}>
              취소
            </Button>
            <Button onClick={handleActionConfirm} disabled={isPending}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

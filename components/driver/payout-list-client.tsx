"use client"

import { useCallback, useState } from "react"
import { fetchDriverPayoutRequestsFiltered } from "@/lib/actions/finance"
import { PayoutListFiltersForm } from "@/components/driver/payout-list-filters-form"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"

const PAGE_SIZE = 10
const payoutStatusLabel: Record<string, string> = {
  requested: "요청됨",
  on_hold: "보류",
  approved: "승인",
  transferred: "이체완료",
  paid: "이체완료",
  rejected: "반려",
  failed: "실패",
  canceled: "취소",
}

type PayoutItem = {
  id: string
  requested_amount: number | null
  status: string | null
  notes: string | null
  requested_at: string | null
  settlement_status: string | null
  payout_status: string | null
}

type ListResult = {
  items: PayoutItem[]
  totalCount: number
  page: number
  pageSize: number
}

type PayoutListClientProps = {
  initialData: ListResult
  initialStatus: string
  initialRequestYear?: string
  /** 서버 초기 로드 실패 시 메시지 */
  initialError?: string | null
}

export function PayoutListClient({ initialData, initialStatus, initialRequestYear = "", initialError }: PayoutListClientProps) {
  const [result, setResult] = useState<ListResult>(initialData)
  const [status, setStatus] = useState(initialStatus)
  const [requestYear, setRequestYear] = useState(initialRequestYear)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const load = useCallback(async (nextStatus: string, page: number, nextYear: string) => {
    setLoading(true)
    setError(null)
    const opts = {
      status: nextStatus === "all" ? undefined : nextStatus,
      requestYear: nextYear || undefined,
      page,
      pageSize: PAGE_SIZE,
    }
    const res = await fetchDriverPayoutRequestsFiltered(opts)
    setLoading(false)
    if ("error" in res && res.error) {
      setError(res.error)
      return
    }
    if ("items" in res) {
      setResult({
        items: res.items ?? [],
        totalCount: res.totalCount ?? 0,
        page: res.page,
        pageSize: res.pageSize,
      })
      setStatus(nextStatus)
      setRequestYear(nextYear)
      setHasLoadedOnce(true)
    }
  }, [])

  const handleSearch = useCallback(
    (nextStatus: string, nextYear: string) => {
      load(nextStatus, 1, nextYear)
    },
    [load],
  )

  const goPage = useCallback(
    (nextPage: number) => {
      load(status, nextPage, requestYear)
    },
    [load, status, requestYear],
  )

  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize))

  return (
    <div className="space-y-4">
      <PayoutListFiltersForm
        key={status}
        onSearch={handleSearch}
        initialStatus={status}
        isPending={loading}
      />
      {(error || (initialError && !hasLoadedOnce)) && (
        <p className="text-sm text-destructive text-center py-2">{error ?? initialError}</p>
      )}
      {result.items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">출금 요청 내역이 없습니다</p>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>요청일시</TableHead>
                  <TableHead className="text-right">요청 금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>회계 상태</TableHead>
                  <TableHead>이체 상태</TableHead>
                  <TableHead>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((payout) => {
                  const mappedSettlementStatus =
                    payout.settlement_status ||
                    (payout.status === "approved" || payout.status === "transferred"
                      ? "CONFIRMED"
                      : payout.status === "on_hold"
                        ? "HOLD"
                        : "READY")
                  const mappedPayoutStatus =
                    payout.payout_status ||
                    (payout.status === "approved"
                      ? "WAITING"
                      : payout.status === "transferred"
                        ? "PAID_OUT"
                        : "NONE")
                  const statusLabel = payoutStatusLabel[payout.status ?? ""] ?? "요청됨"
                  return (
                    <TableRow key={payout.id}>
                      <TableCell className="text-muted-foreground">
                        {payout.requested_at
                          ? new Date(payout.requested_at).toLocaleString("ko-KR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(payout.requested_amount ?? 0).toLocaleString()}원
                      </TableCell>
                      <TableCell>{statusLabel}</TableCell>
                      <TableCell className="text-muted-foreground">{mappedSettlementStatus}</TableCell>
                      <TableCell className="text-muted-foreground">{mappedPayoutStatus}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {(payout.status === "rejected" || payout.status === "on_hold") && payout.notes
                          ? payout.notes
                          : "-"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {(result.totalCount > 0 && (result.totalCount > result.pageSize || totalPages > 1)) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                전체 {result.totalCount}건 중 {(result.page - 1) * result.pageSize + 1}–
                {Math.min(result.page * result.pageSize, result.totalCount)}건
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{result.page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page <= 1 || loading}
                  onClick={() => goPage(result.page - 1)}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page >= totalPages || loading}
                  onClick={() => goPage(result.page + 1)}
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

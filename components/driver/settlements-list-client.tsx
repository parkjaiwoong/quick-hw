"use client"

import { useCallback, useState } from "react"
import { fetchDriverSettlementsFiltered } from "@/lib/actions/settlement"
import type { DriverSettlementsFilters } from "@/lib/actions/settlement"
import type { SettlementsFilterValues } from "@/components/driver/settlements-filters-form"
import { SettlementsFiltersForm, getCurrentMonthYYYYMM } from "@/components/driver/settlements-filters-form"
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
const settlementStatusLabel: Record<string, string> = {
  PENDING: "정산대기",
  READY: "출금대기",
  CONFIRMED: "출금가능",
  PAID_OUT: "출금완료",
}
const paymentMethodLabel: Record<string, string> = {
  cash: "현금",
  card: "카드",
  bank_transfer: "계좌이체",
}

type ListResult = {
  settlements: any[]
  totalCount: number
  page: number
  pageSize: number
}

type SettlementsListClientProps = {
  initialData: ListResult
  initialFilters: SettlementsFilterValues
}

export function SettlementsListClient({ initialData, initialFilters }: SettlementsListClientProps) {
  const [result, setResult] = useState<ListResult>(initialData)
  const [filters, setFilters] = useState<SettlementsFilterValues>(initialFilters)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (nextFilters: SettlementsFilterValues, page: number) => {
    setLoading(true)
    setError(null)
    const opts: DriverSettlementsFilters = {
      settlementMonth: nextFilters.settlementMonth || getCurrentMonthYYYYMM(),
      paymentMethod: nextFilters.paymentMethod !== "all" ? nextFilters.paymentMethod : undefined,
      status: nextFilters.status !== "all" ? nextFilters.status : undefined,
      page,
      pageSize: PAGE_SIZE,
    }
    const res = await fetchDriverSettlementsFiltered(opts)
    setLoading(false)
    if ("error" in res && res.error) {
      setError(res.error)
      return
    }
    if ("settlements" in res) {
      setResult({
        settlements: res.settlements,
        totalCount: res.totalCount,
        page: res.page,
        pageSize: res.pageSize,
      })
      setFilters(nextFilters)
    }
  }, [])

  const handleSearch = useCallback(
    (nextFilters: SettlementsFilterValues) => {
      load(nextFilters, 1)
    },
    [load],
  )

  const goPage = useCallback(
    (nextPage: number) => {
      load(filters, nextPage)
    },
    [load, filters],
  )

  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize))

  return (
    <div className="space-y-4">
      <SettlementsFiltersForm
        key={`${filters.settlementMonth}-${filters.paymentMethod}-${filters.status}`}
        onSearch={handleSearch}
        initialFilters={filters}
        isPending={loading}
      />
      {error && (
        <p className="text-sm text-destructive text-center py-2">{error}</p>
      )}
      {result.settlements.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">조건에 맞는 정산 내역이 없습니다</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>정산일자</TableHead>
                  <TableHead>주문/배송</TableHead>
                  <TableHead className="text-right">정산 금액</TableHead>
                  <TableHead>결제수단</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.settlements.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {(s.settlement_period_end || s.created_at)
                        ? new Date(s.settlement_period_end || s.created_at).toLocaleDateString("ko-KR", {
                            dateStyle: "short",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        주문 - {s.total_deliveries != null ? `${s.total_deliveries}건` : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(s.net_earnings ?? s.settlement_amount ?? 0).toLocaleString()}원
                    </TableCell>
                    <TableCell>
                      {paymentMethodLabel[s.payment?.payment_method ?? ""] ??
                        s.payment?.payment_method ??
                        "-"}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded text-xs bg-muted">
                        {s.settlement_status
                          ? settlementStatusLabel[s.settlement_status] ?? s.settlement_status
                          : "정산대기"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              전체 {result.totalCount}건 중 {(result.page - 1) * result.pageSize + 1}–
              {Math.min(result.page * result.pageSize, result.totalCount)}건
            </p>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                disabled={result.page <= 1 || loading}
                onClick={() => goPage(result.page - 1)}
              >
                이전
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                {result.page} / {totalPages}
              </span>
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
        </>
      )}
    </div>
  )
}

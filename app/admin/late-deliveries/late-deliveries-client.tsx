"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LateDeliveryInfoDialog } from "./late-delivery-info-dialog"
import { getLateDeliveries } from "@/lib/actions/admin-late-deliveries"
import { Clock, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"

type DeliveryRow = {
  id: string
  delivered_at?: string | null
  over_minutes?: number
  customer?: { full_name?: string | null; email?: string | null } | null
  driver?: { full_name?: string | null; email?: string | null } | null
  pickup_address?: string
  delivery_address?: string
  total_fee?: number | null
  payment?: { status?: string } | null
  settlement?: { settlement_status?: string } | null
  [k: string]: unknown
}

type ListData = {
  deliveries: DeliveryRow[]
  total: number
  page: number
  pageSize: number
}

type Filters = { date: string; customer_name: string; driver_name: string }

export function LateDeliveriesClient({
  initialData,
  initialFilters,
}: {
  initialData: ListData
  initialFilters: Filters
}) {
  const [data, setData] = useState<ListData>(initialData)
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(
    async (page: number, overrides: Partial<Filters> = {}) => {
      const f = { ...filters, ...overrides }
      setLoading(true)
      try {
        const result = await getLateDeliveries({
          page,
          pageSize: 20,
          date: f.date?.trim() || null,
          customerName: f.customer_name?.trim() || null,
          driverName: f.driver_name?.trim() || null,
        })
        if (result?.error) {
          setData((prev) => ({ ...prev, deliveries: [], total: 0 }))
          return
        }
        setData({
          deliveries: result.deliveries ?? [],
          total: result.total ?? 0,
          page: result.page ?? page,
          pageSize: result.pageSize ?? 20,
        })
        setFilters(f)
      } finally {
        setLoading(false)
      }
    },
    [filters],
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const date = (form.elements.namedItem("date") as HTMLInputElement)?.value ?? ""
    const customer_name = (form.elements.namedItem("customer_name") as HTMLInputElement)?.value ?? ""
    const driver_name = (form.elements.namedItem("driver_name") as HTMLInputElement)?.value ?? ""
    fetchData(1, { date, customer_name, driver_name })
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const currentPage = Math.min(data.page, totalPages)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>조회 조건</CardTitle>
          <CardDescription>일자, 고객명, 기사명으로 필터 후 조회할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">일자</label>
              <Input
                type="date"
                name="date"
                key={`date-${filters.date}`}
                defaultValue={filters.date}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">고객명</label>
              <Input
                name="customer_name"
                placeholder="이름 또는 이메일"
                key={`customer_name-${filters.customer_name}`}
                defaultValue={filters.customer_name}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">기사명</label>
              <Input
                name="driver_name"
                placeholder="이름 또는 이메일"
                key={`driver_name-${filters.driver_name}`}
                defaultValue={filters.driver_name}
                className="w-[180px]"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "조회 중..." : "조회"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>초과 완료 건 (총 {data.total.toLocaleString()}건)</CardTitle>
          <CardDescription>
            수락 시각 + 예상시간(분)보다 늦게 배송 완료된 건만 표시됩니다. 기사 교육·평가·보상 정책 참고용으로 활용하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && data.deliveries.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">조회 중...</p>
          ) : data.deliveries.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">조건에 맞는 예상시간 초과 배송이 없습니다.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>배송 ID</TableHead>
                      <TableHead>완료 일시</TableHead>
                      <TableHead>초과 시간</TableHead>
                      <TableHead>고객</TableHead>
                      <TableHead>기사</TableHead>
                      <TableHead>픽업 → 배송지</TableHead>
                      <TableHead>요금</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.deliveries.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          {d.delivered_at
                            ? new Date(d.delivered_at).toLocaleString("ko-KR", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {d.over_minutes}분 초과
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {d.customer?.full_name || d.customer?.email || "-"}
                        </TableCell>
                        <TableCell>
                          {d.driver?.full_name || d.driver?.email || "-"}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">
                          {d.pickup_address} → {d.delivery_address}
                        </TableCell>
                        <TableCell>{Number(d.total_fee ?? 0).toLocaleString()}원</TableCell>
                        <TableCell>
                          <LateDeliveryInfoDialog
                            delivery={d}
                            payment={d.payment ?? null}
                            settlement={d.settlement ?? null}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {(currentPage - 1) * data.pageSize + 1}-{Math.min(currentPage * data.pageSize, data.total)} / {data.total}건
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage <= 1 || loading}
                      onClick={() => currentPage > 1 && fetchData(currentPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage >= totalPages || loading}
                      onClick={() => currentPage < totalPages && fetchData(currentPage + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

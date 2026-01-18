"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type PayoutRow = {
  id: string
  requested_amount: number
  status: string
  bank_name?: string | null
  bank_account?: string | null
  requested_at?: string | null
  notes?: string | null
  driver?: { full_name?: string | null; email?: string | null; phone?: string | null }
}

interface PayoutRequestsPanelProps {
  payouts: PayoutRow[]
  onMarkPaid: (id: string) => Promise<{ error?: string } | void>
}

const filterOptions = [
  { value: "all", label: "전체" },
  { value: "pending", label: "요청됨" },
  { value: "paid", label: "완료" },
  { value: "rejected", label: "반려" },
]

export function PayoutRequestsPanel({ payouts, onMarkPaid, onReject }: PayoutRequestsPanelProps) {
  const [filter, setFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    if (filter === "all") return payouts
    if (filter === "pending") return payouts.filter((p) => p.status === "pending" || p.status === "approved")
    if (filter === "paid") return payouts.filter((p) => p.status === "paid")
    return payouts.filter((p) => p.status === "rejected")
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

  const downloadCsv = () => {
    const rows = payouts.filter((p) => selectedIds.includes(p.id))
    if (!rows.length) return
    const header = ["기사명", "은행", "계좌번호", "출금액", "상태", "요청일", "반려 사유"]
    const data = rows.map((row) => [
      row.driver?.full_name || row.driver?.email || "기사",
      row.bank_name || "",
      row.bank_account || "",
      Number(row.requested_amount || 0).toString(),
      row.status,
      row.requested_at ? new Date(row.requested_at).toLocaleDateString("ko-KR") : "",
      row.notes || "",
    ])
    const csv = [header, ...data].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "payout_requests_selected.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleMarkPaid = (id: string) => {
    startTransition(async () => {
      const result = await onMarkPaid(id)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success("출금 완료 처리되었습니다.")
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
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleSelectAll}>
            {selectedIds.length === filtered.length && filtered.length > 0 ? "전체 해제" : "전체 선택"}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!selectedIds.length}>
            선택 엑셀 다운로드
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">출금 요청이 없습니다</p>
      ) : (
        filtered.map((payout) => {
          const statusLabel =
            payout.status === "paid" ? "완료" : payout.status === "rejected" ? "반려" : "요청됨"
          const reasonValue = rejectReasons[payout.id] || ""
          return (
            <div key={payout.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(payout.id)}
                    onChange={() => toggleSelect(payout.id)}
                  />
                  <div>
                    <p className="font-semibold">{payout.driver?.full_name || payout.driver?.email || "기사"}</p>
                    <p className="text-sm text-muted-foreground">
                      요청 금액: {Number(payout.requested_amount || 0).toLocaleString()}원
                    </p>
                    <p className="text-xs text-muted-foreground">
                      계좌: {payout.bank_name || "-"} {payout.bank_account || "-"}
                    </p>
                  </div>
                </label>
                <span className="text-xs rounded px-2 py-1 bg-muted">{statusLabel}</span>
              </div>

              {payout.status === "rejected" && payout.notes && (
                <p className="text-xs text-red-600">반려 사유: {payout.notes}</p>
              )}
              {payout.status === "rejected" && !payout.notes && (
                <p className="text-xs text-red-600">반려 사유가 입력되지 않았습니다.</p>
              )}

              {(payout.status === "pending" || payout.status === "approved") && (
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <Input placeholder="반려 사유는 운영툴에서 입력합니다" disabled />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={isPending} onClick={() => handleMarkPaid(payout.id)}>
                      출금 완료
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

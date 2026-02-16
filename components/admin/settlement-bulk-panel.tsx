"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { SettlementConfirmButton } from "@/components/admin/settlement-confirm-button"
import { bulkConfirmSettlements, unlockSettlement } from "@/lib/actions/finance"

type SettlementRow = {
  id: string
  driver_id?: string | null
  order_id?: string | null
  status?: string | null
  settlement_status?: string | null
  payment_status?: string | null
  payment?: { amount?: number | null; status?: string | null }
  settlement_period_start?: string | null
  settlement_period_end?: string | null
  settlement_date?: string | null
  created_at?: string | null
  confirmed_at?: string | null
  total_deliveries?: number | null
  total_earnings?: number | null
  settlement_amount?: number | null
  net_earnings?: number | null
  driver?: { full_name?: string | null; email?: string | null }
}

interface SettlementBulkPanelProps {
  settlements: SettlementRow[]
}

export function SettlementBulkPanel({ settlements }: SettlementBulkPanelProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [isDownloading, setIsDownloading] = useState(false)

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "processing" | "completed">("all")
  const filteredSettlements = useMemo(() => {
    if (statusFilter === "all") return settlements
    return settlements.filter((s) => s.status === statusFilter)
  }, [settlements, statusFilter])

  const selectedCount = selectedIds.length
  const allowManualConfirm = false
  const selectableIds = useMemo(() => {
    if (!allowManualConfirm) return []
    return filteredSettlements
      .filter((s) => {
        const paymentStatus = s.payment_status || s.payment?.status
        return s.settlement_status === "PENDING" && paymentStatus === "PAID"
      })
      .map((s) => s.id)
  }, [allowManualConfirm, filteredSettlements])
  const downloadableSettlements = useMemo(
    () =>
      filteredSettlements.filter((s) =>
        ["PENDING", "CONFIRMED", "PAID_OUT"].includes(String(s.settlement_status || "")),
      ),
    [filteredSettlements],
  )

  const toggleSelect = (id: string, isSelectable: boolean) => {
    if (!isSelectable) return
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === selectableIds.length) {
      setSelectedIds([])
      return
    }
    setSelectedIds(selectableIds)
  }

  const handleConfirm = () => {
    startTransition(async () => {
      if (!allowManualConfirm) return
      const result = await bulkConfirmSettlements(selectedIds)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }

      const successCount = result?.successCount ?? 0
      const skippedCount = result?.skippedCount ?? 0
      const excludedCount = result?.excludedCount ?? 0
      const failedCount = result?.failed?.length ?? 0

      if (successCount > 0) {
        toast.success(`정산확정 완료: 성공 ${successCount}건`)
      }
      if (skippedCount > 0) {
        toast.message(`정산확정 제외 ${skippedCount}건 (이미 처리됨)`)
      }
      if (excludedCount > 0) {
        toast.message(`결제 미완료 제외 ${excludedCount}건`)
      }
      if (failedCount > 0) {
        toast.error(`정산확정 실패 ${failedCount}건`)
      }

      setSelectedIds([])
      router.refresh()
    })
  }

  const handleUnlock = (settlementId: string) => {
    startTransition(async () => {
      const result = await unlockSettlement(settlementId)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success("잠금 해제 완료")
      router.refresh()
    })
  }

  const formatDate = (value?: string | null) => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`
  }

  const getStatusLabel = (status?: string | null) => {
    if (status === "PENDING") return "정산대기"
    if (status === "READY") return "정산준비"
    if (status === "CONFIRMED") return "출금가능"
    if (status === "HOLD") return "보류"
    if (status === "LOCKED") return "잠금"
    if (status === "PAID_OUT") return "출금완료"
    return ""
  }

  const getPaymentStatusLabel = (status?: string | null) => {
    if (status === "READY") return "결제대기"
    if (status === "PAID") return "결제완료"
    if (status === "FAILED") return "결제실패"
    if (status === "CANCELED") return "결제취소"
    return "미결제"
  }

  const getPaymentStatusBadge = (status?: string | null) => {
    if (status === "PAID") return "bg-emerald-100 text-emerald-800"
    if (status === "READY") return "bg-gray-100 text-gray-700"
    if (status === "FAILED" || status === "CANCELED") return "bg-red-100 text-red-700"
    return "bg-gray-100 text-gray-700"
  }

  const getCompletedAt = (settlement: SettlementRow) => {
    return (
      settlement.settlement_period_end ||
      settlement.settlement_date ||
      settlement.created_at ||
      ""
    )
  }

  const handleDownload = async () => {
    if (!downloadableSettlements.length || isDownloading) return
    setIsDownloading(true)
    try {
      const header = [
        "정산ID",
        "주문번호",
        "기사명",
        "기사ID",
        "배송완료일",
        "결제금액",
        "기사정산금",
        "정산상태",
        "결제 상태",
        "정산확정일",
      ]
      const rows = downloadableSettlements.map((settlement) => [
        settlement.id,
        settlement.order_id || "",
        settlement.driver?.full_name || settlement.driver?.email || "알 수 없음",
        settlement.driver_id || "",
        formatDate(getCompletedAt(settlement)),
        Number(settlement.payment?.amount ?? settlement.total_earnings ?? 0),
        Number(settlement.settlement_amount ?? settlement.net_earnings ?? 0),
        getStatusLabel(settlement.settlement_status),
        (settlement.payment_status || settlement.payment?.status || "").toString(),
        formatDate(settlement.confirmed_at || ""),
      ])
      const sheet = XLSX.utils.aoa_to_sheet([header, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "settlements")
      const today = new Date()
      const fileName = `settlements_${today.getFullYear()}${String(today.getMonth() + 1).padStart(
        2,
        "0",
      )}${String(today.getDate()).padStart(2, "0")}.xlsx`
      XLSX.writeFile(workbook, fileName)
      toast.success("엑셀 다운로드가 완료되었습니다.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "엑셀 다운로드에 실패했습니다.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "processing", "completed"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant={statusFilter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(value)}
          >
            {value === "all"
              ? "전체"
              : value === "pending"
                ? "대기 중"
                : value === "processing"
                  ? "처리 중"
                  : "완료"}
          </Button>
        ))}
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          결제 완료 시 자동 정산됩니다.
          <Button type="button" variant="ghost" size="sm" onClick={toggleSelectAll}>
            {selectedIds.length === selectableIds.length && selectableIds.length > 0 ? "전체 해제" : "전체 선택"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!downloadableSettlements.length || isDownloading}
          >
            {isDownloading ? "다운로드 중..." : "엑셀 다운로드"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" size="sm" disabled>
                정산확정 (자동)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>정산확정</AlertDialogTitle>
                <AlertDialogDescription>
                  결제 완료 시 자동 정산됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>확인</AlertDialogCancel>
                <AlertDialogAction disabled onClick={handleConfirm}>
                  확인
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {filteredSettlements.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {statusFilter === "all" ? "정산 내역이 없습니다" : "해당 상태의 정산이 없습니다"}
        </p>
      ) : (
        filteredSettlements.map((settlement) => {
          const paymentStatus = settlement.payment_status || settlement.payment?.status
          const isSelectable = allowManualConfirm && settlement.settlement_status === "PENDING" && paymentStatus === "PAID"
          return (
            <div key={settlement.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex gap-3 items-start">
                <Checkbox
                  checked={selectedIds.includes(settlement.id)}
                  onCheckedChange={() => toggleSelect(settlement.id, isSelectable)}
                  disabled={!isSelectable}
                  className="mt-1"
                  aria-label="정산 선택"
                />
                <div className="flex-1 flex justify-between items-start">
                  <div>
                    <p className="font-semibold">
                      {settlement.driver?.full_name || settlement.driver?.email || "알 수 없음"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      기간: {settlement.settlement_period_start ? new Date(settlement.settlement_period_start).toLocaleDateString("ko-KR") : "-"} ~{" "}
                      {settlement.settlement_period_end ? new Date(settlement.settlement_period_end).toLocaleDateString("ko-KR") : "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      배송 건수: {settlement.total_deliveries}건 | 정산 금액:{" "}
                      {settlement.net_earnings?.toLocaleString()}원
                    </p>
                    <p className="text-sm text-muted-foreground">
                      결제 상태:{" "}
                      <Badge className={getPaymentStatusBadge(paymentStatus)}>
                        {getPaymentStatusLabel(paymentStatus)}
                      </Badge>
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        settlement.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : settlement.status === "processing"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {settlement.status === "completed"
                        ? "완료"
                        : settlement.status === "processing"
                          ? "처리 중"
                          : "대기 중"}
                    </span>
                    {settlement.settlement_status === "PENDING" && (
                      <SettlementConfirmButton
                        settlementId={settlement.id}
                        disabled
                        helperText="결제 완료 시 자동 정산됩니다."
                      />
                    )}
                    {settlement.settlement_status === "LOCKED" && (
                      <Button size="sm" className="mt-2" onClick={() => handleUnlock(settlement.id)} disabled={isPending}>
                        잠금 해제
                      </Button>
                    )}
                    {settlement.settlement_status === "CONFIRMED" && (
                      <div className="mt-2 text-xs text-emerald-700 font-semibold">출금 가능 상태로 전환됨</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}

      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm" disabled>
              정산확정 (자동)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>정산확정</AlertDialogTitle>
              <AlertDialogDescription>
                결제 완료 시 자동 정산됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>확인</AlertDialogCancel>
              <AlertDialogAction disabled onClick={handleConfirm}>
                확인
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

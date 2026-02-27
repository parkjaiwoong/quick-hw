"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { ChevronDown, ChevronUp, User, Phone, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { bulkConfirmSettlements, unlockSettlement } from "@/lib/actions/finance"

type SettlementItem = {
  id: string
  driver_id?: string | null
  settlement_amount?: number | null
  payment_status?: string | null
  settlement_status?: string | null
  status?: string | null
  settlement_period_start?: string | null
  settlement_period_end?: string | null
  created_at?: string | null
  confirmed_at?: string | null
  order_id?: string | null
  delivery_id?: string | null
  payment?: { amount?: number | null; status?: string | null } | null
}

type DriverGroup = {
  driver_id: string
  full_name: string
  email: string
  phone: string | null
  total_count: number
  paid_count: number
  canceled_count: number
  pending_count: number
  total_amount: number
  paid_amount: number
  canceled_amount: number
  pending_amount: number
  first_date: string | null
  last_date: string | null
  items: SettlementItem[]
}

interface Props {
  driverGroups: DriverGroup[]
}

function formatDate(v?: string | null) {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "-"
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function paymentStatusLabel(s?: string | null) {
  if (s === "PAID") return { label: "결제완료", cls: "bg-emerald-100 text-emerald-800" }
  if (s === "CANCELED") return { label: "결제취소", cls: "bg-red-100 text-red-700" }
  if (s === "READY") return { label: "결제대기", cls: "bg-gray-100 text-gray-700" }
  return { label: s ?? "-", cls: "bg-gray-100 text-gray-500" }
}

function settlementStatusLabel(s?: string | null) {
  if (s === "PENDING") return { label: "정산대기", cls: "bg-yellow-100 text-yellow-800" }
  if (s === "READY") return { label: "정산준비", cls: "bg-blue-100 text-blue-800" }
  if (s === "CONFIRMED") return { label: "출금가능", cls: "bg-emerald-100 text-emerald-800" }
  if (s === "PAID_OUT") return { label: "출금완료", cls: "bg-green-100 text-green-800" }
  if (s === "CANCELED") return { label: "취소", cls: "bg-red-100 text-red-700" }
  return { label: s ?? "-", cls: "bg-gray-100 text-gray-500" }
}

/** CSV 셀 값 이스케이프 (쉼표·따옴표·줄바꿈 포함 시 따옴표로 감쌈) */
function csvCell(v: string | number): string {
  const s = String(v)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** UTF-8 BOM CSV 다운로드 */
function downloadCsv(groups: DriverGroup[], filename: string) {
  const header = ["기사명", "이메일", "날짜", "정산금액", "결제상태", "정산상태", "주문번호", "정산ID"]
  const rows: string[] = [header.map(csvCell).join(",")]
  for (const g of groups) {
    const name = g.full_name || g.email || `기사(${g.driver_id.slice(0, 8)})`
    for (const item of g.items) {
      rows.push([
        name,
        g.email,
        formatDate(item.settlement_period_end ?? item.created_at),
        Number(item.settlement_amount ?? 0),
        paymentStatusLabel(item.payment_status).label,
        settlementStatusLabel(item.settlement_status).label,
        item.order_id ?? "",
        item.id,
      ].map(csvCell).join(","))
    }
  }
  // UTF-8 BOM(\uFEFF) 추가 — Excel이 한글을 올바르게 인식
  const bom = "\uFEFF"
  const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── 기사별 행 컴포넌트 ───────────────────────────────────────────────────────
function DriverRow({
  group,
  onUnlock,
  isPending,
}: {
  group: DriverGroup
  onUnlock: (id: string) => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const driverName = group.full_name || group.email || `기사 (${group.driver_id.slice(0, 8)}…)`

  const handleDriverExcel = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const today = new Date()
      const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
      downloadCsv([group], `settlement_${group.full_name || group.driver_id.slice(0, 8)}_${ymd}.csv`)
      toast.success("다운로드 완료")
    } catch {
      toast.error("다운로드 실패")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Summary 행 — div로 감싸서 button 중첩 방지 */}
      <div
        className={cn(
          "w-full px-4 py-4 flex items-center gap-3 hover:bg-accent/30 transition-colors cursor-pointer",
          open && "bg-accent/20"
        )}
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
      >
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
          {/* 기사 정보 */}
          <div className="flex items-center gap-2 col-span-2 md:col-span-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{driverName}</p>
              <p className="text-xs text-muted-foreground truncate">{group.email}</p>
              {group.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />{group.phone}
                </p>
              )}
            </div>
          </div>

          {/* 건수 */}
          <div className="text-sm space-y-0.5">
            <p className="text-muted-foreground text-xs">배송 건수</p>
            <p className="font-semibold">{group.total_count}건</p>
            <div className="flex gap-1 flex-wrap">
              {group.paid_count > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">완료 {group.paid_count}</span>
              )}
              {group.canceled_count > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">취소 {group.canceled_count}</span>
              )}
              {group.pending_count > 0 && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">대기 {group.pending_count}</span>
              )}
            </div>
          </div>

          {/* 금액 */}
          <div className="text-sm space-y-0.5">
            <p className="text-muted-foreground text-xs">정산 금액</p>
            <p className="font-bold text-base">{group.total_amount.toLocaleString()}원</p>
            {group.paid_amount > 0 && (
              <p className="text-xs text-emerald-700">완료 {group.paid_amount.toLocaleString()}원</p>
            )}
            {group.pending_amount > 0 && (
              <p className="text-xs text-yellow-700">대기 {group.pending_amount.toLocaleString()}원</p>
            )}
          </div>

          {/* 기간 */}
          <div className="text-sm space-y-0.5">
            <p className="text-muted-foreground text-xs">기간</p>
            <p className="text-xs">{formatDate(group.first_date)}</p>
            <p className="text-xs text-muted-foreground">~ {formatDate(group.last_date)}</p>
          </div>
        </div>

        {/* 기사별 엑셀 버튼 — 클릭 이벤트 전파 차단 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleDriverExcel}
          disabled={isDownloading}
          title="이 기사 정산 엑셀 다운로드"
        >
          <Download className="w-4 h-4" />
        </Button>

        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* 상세 목록 */}
      {open && (
        <div className="border-t bg-muted/20">
          {/* 헤더 */}
          <div className="grid grid-cols-12 text-xs font-semibold text-muted-foreground px-4 py-2 border-b bg-muted/30">
            <div className="col-span-2">날짜</div>
            <div className="col-span-2">정산금액</div>
            <div className="col-span-2">결제상태</div>
            <div className="col-span-2">정산상태</div>
            <div className="col-span-3">주문번호</div>
            <div className="col-span-1"></div>
          </div>

          {group.items.map((item) => {
            const ps = paymentStatusLabel(item.payment_status)
            const ss = settlementStatusLabel(item.settlement_status)
            return (
              <div
                key={item.id}
                className="grid grid-cols-12 items-center text-sm px-4 py-2.5 border-b last:border-b-0 hover:bg-accent/20"
              >
                <div className="col-span-2 text-xs text-muted-foreground">
                  {formatDate(item.settlement_period_end ?? item.created_at)}
                </div>
                <div className="col-span-2 font-semibold">
                  {Number(item.settlement_amount ?? 0).toLocaleString()}원
                </div>
                <div className="col-span-2">
                  <Badge className={cn("text-xs px-1.5 py-0.5", ps.cls)}>{ps.label}</Badge>
                </div>
                <div className="col-span-2">
                  <Badge className={cn("text-xs px-1.5 py-0.5", ss.cls)}>{ss.label}</Badge>
                </div>
                <div className="col-span-3 text-xs text-muted-foreground truncate" title={item.order_id ?? item.id}>
                  {item.order_id ? item.order_id.slice(0, 14) + "…" : item.id.slice(0, 14) + "…"}
                </div>
                <div className="col-span-1 flex justify-end">
                  {item.settlement_status === "LOCKED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-6 px-2"
                      onClick={() => onUnlock(item.id)}
                      disabled={isPending}
                    >
                      잠금해제
                    </Button>
                  )}
                  {item.settlement_status === "CONFIRMED" && (
                    <span className="text-xs text-emerald-700 font-semibold">출금가능</span>
                  )}
                </div>
              </div>
            )
          })}

          {/* 소계 */}
          <div className="grid grid-cols-12 items-center text-sm px-4 py-2.5 bg-muted/40 font-semibold border-t">
            <div className="col-span-2 text-xs text-muted-foreground">소계</div>
            <div className="col-span-2 text-base">{group.total_amount.toLocaleString()}원</div>
            <div className="col-span-2 text-xs text-emerald-700">완료 {group.paid_amount.toLocaleString()}원</div>
            <div className="col-span-2 text-xs text-yellow-700">대기 {group.pending_amount.toLocaleString()}원</div>
            <div className="col-span-4 text-xs text-red-700">취소 {group.canceled_amount.toLocaleString()}원</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function SettlementDriverList({ driverGroups }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDownloading, setIsDownloading] = useState(false)

  // 결제완료(PAID) + 정산대기(PENDING 또는 READY) 건 — 정산확정 대상
  const confirmableIds = driverGroups
    .flatMap((g) => g.items)
    .filter(
      (item) =>
        item.payment_status === "PAID" &&
        (item.settlement_status === "PENDING" || item.settlement_status === "READY"),
    )
    .map((item) => item.id)

  const handleConfirmAll = () => {
    startTransition(async () => {
      const result = await bulkConfirmSettlements(confirmableIds)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      const successCount = result?.successCount ?? 0
      const skippedCount = result?.skippedCount ?? 0
      const failedCount = result?.failed?.length ?? 0
      if (successCount > 0) toast.success(`정산확정 완료: ${successCount}건`)
      if (skippedCount > 0) toast.message(`이미 처리됨: ${skippedCount}건`)
      if (failedCount > 0) toast.error(`실패: ${failedCount}건`)
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

  const handleDownloadAll = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const today = new Date()
      const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
      downloadCsv(driverGroups, `settlements_all_${ymd}.csv`)
      toast.success("다운로드 완료")
    } catch {
      toast.error("다운로드 실패")
    } finally {
      setIsDownloading(false)
    }
  }

  if (driverGroups.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">정산 내역이 없습니다</p>
  }

  return (
    <div className="space-y-4">
      {/* 액션 버튼 영역 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          결제완료 시 자동 정산됩니다.
          {confirmableIds.length > 0 && (
            <span className="ml-2 text-yellow-700 font-semibold">
              정산확정 대기 {confirmableIds.length}건
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {/* 전체 엑셀 다운로드 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={isDownloading}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {isDownloading ? "다운로드 중..." : "전체 CSV 다운로드"}
          </Button>

          {/* 정산확정 */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                disabled={confirmableIds.length === 0 || isPending}
                variant={confirmableIds.length > 0 ? "default" : "outline"}
              >
                정산확정 ({confirmableIds.length}건)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>정산확정</AlertDialogTitle>
                <AlertDialogDescription>
                  결제완료된 {confirmableIds.length}건을 정산확정 처리합니다.
                  확정 후에는 기사에게 출금 가능 상태로 전환됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmAll} disabled={isPending}>
                  {isPending ? "처리 중..." : "확정"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 기사별 목록 */}
      {driverGroups.map((group) => (
        <DriverRow
          key={group.driver_id}
          group={group}
          onUnlock={handleUnlock}
          isPending={isPending}
        />
      ))}
    </div>
  )
}

"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, CalendarDays, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"

// ────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────
export type PaymentTab = "all" | "paid" | "pending" | "cancelled"

interface PaymentFilterBarProps {
  selectedMonth: string
  availableMonths: string[]
  selectedTab: PaymentTab
  counts: Record<PaymentTab, number>
}

// ────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────
function getMonthLabel(key: string) {
  const [year, month] = key.split("-")
  return `${year}년 ${Number(month)}월`
}

function addMonths(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const TAB_CONFIG: { value: PaymentTab; label: string; badgeColor: string }[] = [
  { value: "all",       label: "전체",     badgeColor: "bg-gray-100 text-gray-700" },
  { value: "paid",      label: "완료",     badgeColor: "bg-green-100 text-green-700" },
  { value: "pending",   label: "대기",     badgeColor: "bg-yellow-100 text-yellow-700" },
  { value: "cancelled", label: "취소/환불", badgeColor: "bg-red-100 text-red-700" },
]

// ────────────────────────────────────────────────
// 컴포넌트
// ────────────────────────────────────────────────
export function PaymentFilterBar({
  selectedMonth,
  availableMonths,
  selectedTab,
  counts,
}: PaymentFilterBarProps) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  function navigate(patch: { month?: string; tab?: PaymentTab }) {
    const params = new URLSearchParams(searchParams.toString())
    if (patch.month !== undefined) params.set("month", patch.month)
    if (patch.tab !== undefined) {
      if (patch.tab === "all") params.delete("tab")
      else params.set("tab", patch.tab)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const prevMonth      = addMonths(selectedMonth, -1)
  const nextMonth      = addMonths(selectedMonth, 1)
  const isNextDisabled = nextMonth > currentMonthKey
  const oldestAvailable = availableMonths.length > 0
    ? availableMonths[availableMonths.length - 1]
    : currentMonthKey
  const isPrevDisabled = selectedMonth <= oldestAvailable && availableMonths.length > 0

  const selectedCfg = TAB_CONFIG.find((t) => t.value === selectedTab) ?? TAB_CONFIG[0]

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">

      {/* ── 월 선택 피커 ── */}
      <div className="flex items-center gap-1 bg-white border rounded-xl px-3 py-2 shadow-sm">
        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mr-1" />

        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => navigate({ month: prevMonth })}
          disabled={isPrevDisabled}
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <select
          value={selectedMonth}
          onChange={(e) => navigate({ month: e.target.value })}
          className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer min-w-[110px] text-center"
          aria-label="조회 년월 선택"
        >
          {!availableMonths.includes(currentMonthKey) && (
            <option value={currentMonthKey}>{getMonthLabel(currentMonthKey)}</option>
          )}
          {availableMonths.map((m) => (
            <option key={m} value={m}>{getMonthLabel(m)}</option>
          ))}
          {!availableMonths.includes(selectedMonth) && selectedMonth !== currentMonthKey && (
            <option value={selectedMonth}>{getMonthLabel(selectedMonth)}</option>
          )}
        </select>

        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => navigate({ month: nextMonth })}
          disabled={isNextDisabled}
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {selectedMonth !== currentMonthKey && (
          <Button
            variant="outline" size="sm" className="h-7 text-xs ml-1"
            onClick={() => navigate({ month: currentMonthKey })}
          >
            이번 달
          </Button>
        )}
      </div>

      {/* ── 구분 콤보 + 건수 배지 ── */}
      <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        <select
          value={selectedTab}
          onChange={(e) => navigate({ tab: e.target.value as PaymentTab })}
          className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer pr-1"
          aria-label="결제 구분 선택"
        >
          {TAB_CONFIG.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* 선택된 구분의 건수 배지 */}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold leading-none ${selectedCfg.badgeColor}`}>
          {counts[selectedTab]}건
        </span>

        {/* 전체 건수 요약 (선택이 전체가 아닐 때만) */}
        {selectedTab !== "all" && (
          <span className="text-xs text-muted-foreground">
            / 전체 {counts.all}건
          </span>
        )}
      </div>

      {/* ── 구분별 건수 요약 칩 (항상 표시) ── */}
      <div className="flex flex-wrap gap-1.5">
        {TAB_CONFIG.filter((t) => t.value !== "all").map(({ value, label, badgeColor }) => (
          <button
            key={value}
            type="button"
            onClick={() => navigate({ tab: value })}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity border ${
              selectedTab === value ? "opacity-100 ring-2 ring-primary/40 border-primary/30" : "opacity-70 hover:opacity-100 border-transparent"
            } ${badgeColor}`}
          >
            {label}
            <span className="font-bold">{counts[value as PaymentTab]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

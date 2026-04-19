"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function getCurrentMonthYYYYMM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

const PAYMENT_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "cash", label: "현금" },
  { value: "card", label: "카드" },
  { value: "bank_transfer", label: "계좌이체" },
]

const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "PENDING", label: "정산대기" },
  { value: "READY", label: "출금대기" },
  { value: "CONFIRMED", label: "출금가능" },
  { value: "PAID_OUT", label: "출금완료" },
]

export type SettlementsFilterValues = {
  settlementMonth: string
  paymentMethod: string
  status: string
}

type SettlementsFiltersFormProps = {
  /** 클라이언트 전용 조회 시 사용. 지정하면 URL 이동 없이 onSearch만 호출 */
  onSearch?: (filters: SettlementsFilterValues) => void
  /** onSearch 사용 시 초기값 (정산월·결제수단·상태) */
  initialFilters?: SettlementsFilterValues
  /** 조회 중 여부 (버튼 비활성 등) */
  isPending?: boolean
}

export function SettlementsFiltersForm({
  onSearch,
  initialFilters,
  isPending: isPendingProp,
}: SettlementsFiltersFormProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPendingTransition, startTransition] = useTransition()

  const defaultMonth = getCurrentMonthYYYYMM()
  const useClientMode = typeof onSearch === "function"

  const settlementMonth = useClientMode
    ? (initialFilters?.settlementMonth ?? defaultMonth)
    : (searchParams.get("settlementMonth") ?? defaultMonth)
  const paymentMethod = useClientMode
    ? (initialFilters?.paymentMethod ?? "all")
    : (searchParams.get("paymentMethod") ?? "all")
  const status = useClientMode
    ? (initialFilters?.status ?? "all")
    : (searchParams.get("status") ?? "all")

  const isPending = isPendingProp ?? isPendingTransition

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const month = (fd.get("settlementMonth") as string)?.trim() || defaultMonth
    const pm = (fd.get("paymentMethod") as string)?.trim() || "all"
    const st = (fd.get("status") as string)?.trim() || "all"
    const filters: SettlementsFilterValues = { settlementMonth: month, paymentMethod: pm, status: st }

    if (onSearch) {
      onSearch(filters)
      return
    }
    const next = new URLSearchParams()
    next.set("settlementMonth", month)
    if (pm !== "all") next.set("paymentMethod", pm)
    if (st !== "all") next.set("status", st)
    next.set("page", "1")
    startTransition(() => {
      router.push(`/driver/settlements?${next.toString()}`)
    })
  }

  const handleReset = () => {
    if (onSearch) {
      onSearch({
        settlementMonth: defaultMonth,
        paymentMethod: "all",
        status: "all",
      })
      return
    }
    startTransition(() => {
      router.push(`/driver/settlements?settlementMonth=${getCurrentMonthYYYYMM()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="list-item-card flex flex-wrap items-end gap-4 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="settlementMonth">정산월</Label>
        <Input
          id="settlementMonth"
          name="settlementMonth"
          type="month"
          defaultValue={settlementMonth}
          className="w-[160px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paymentMethod">결제수단</Label>
        <select
          id="paymentMethod"
          name="paymentMethod"
          defaultValue={paymentMethod}
          className="flex h-9 w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          {PAYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status">상태</Label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="flex h-9 w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "조회 중…" : "조회"}</Button>
        <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={isPending}>초기화</Button>
      </div>
    </form>
  )
}

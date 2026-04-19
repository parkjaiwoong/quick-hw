"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export const PAYOUT_STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "requested", label: "요청됨" },
  { value: "on_hold", label: "보류" },
  { value: "approved", label: "승인" },
  { value: "transferred", label: "이체완료" },
  { value: "rejected", label: "반려" },
  { value: "failed", label: "실패" },
] as const

const PAYOUT_YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear()
  const options = [{ value: "", label: "전체" }]
  for (let y = current; y >= current - 5; y--) {
    options.push({ value: String(y), label: String(y) + "년" })
  }
  return options
})()

type PayoutListFiltersFormProps = {
  /** 클라이언트 전용 조회 시 사용. 지정하면 URL 이동 없이 onSearch만 호출 */
  onSearch?: (status: string, requestYear: string) => void
  /** onSearch 사용 시 초기/현재 상태값 */
  initialStatus?: string
  /** onSearch 사용 시 초기/현재 요청년도 */
  initialRequestYear?: string
  /** 조회 중 여부 */
  isPending?: boolean
}

export function PayoutListFiltersForm({
  onSearch,
  initialStatus = "all",
  initialRequestYear = "",
  isPending: isPendingProp,
}: PayoutListFiltersFormProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPendingTransition, startTransition] = useTransition()
  const useClientMode = typeof onSearch === "function"
  const status = useClientMode ? initialStatus : (searchParams.get("payoutStatus") ?? "all")
  const requestYear = useClientMode ? initialRequestYear : (searchParams.get("payoutYear") ?? "")
  const isPending = isPendingProp ?? isPendingTransition

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const st = (fd.get("payoutStatus") as string)?.trim() || "all"
    const yr = (fd.get("payoutYear") as string)?.trim() || ""
    if (onSearch) {
      onSearch(st, yr)
      return
    }
    const next = new URLSearchParams(searchParams.toString())
    if (st !== "all") next.set("payoutStatus", st)
    else next.delete("payoutStatus")
    if (yr) next.set("payoutYear", yr)
    else next.delete("payoutYear")
    next.set("payoutPage", "1")
    startTransition(() => {
      router.push(`/driver/wallet?${next.toString()}`)
    })
  }

  const handleReset = () => {
    if (onSearch) {
      onSearch("all", "")
      return
    }
    const next = new URLSearchParams(searchParams.toString())
    next.delete("payoutStatus")
    next.delete("payoutYear")
    next.delete("payoutPage")
    startTransition(() => {
      router.push(`/driver/wallet?${next.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="list-item-card flex flex-wrap items-end gap-3 p-3 bg-muted/30">
      <div className="space-y-1.5">
        <Label htmlFor="payoutYear">요청년도</Label>
        <select
          id="payoutYear"
          name="payoutYear"
          defaultValue={requestYear}
          className="flex h-9 w-[100px] rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          {PAYOUT_YEAR_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payoutStatus">상태</Label>
        <select
          id="payoutStatus"
          name="payoutStatus"
          defaultValue={status}
          className="flex h-9 w-[120px] rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          {PAYOUT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "조회 중…" : "조회"}</Button>
      <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={isPending}>초기화</Button>
    </form>
  )
}

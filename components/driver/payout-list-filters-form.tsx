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

type PayoutListFiltersFormProps = {
  /** 클라이언트 전용 조회 시 사용. 지정하면 URL 이동 없이 onSearch만 호출 */
  onSearch?: (status: string) => void
  /** onSearch 사용 시 초기/현재 상태값 */
  initialStatus?: string
  /** 조회 중 여부 */
  isPending?: boolean
}

export function PayoutListFiltersForm({
  onSearch,
  initialStatus = "all",
  isPending: isPendingProp,
}: PayoutListFiltersFormProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPendingTransition, startTransition] = useTransition()
  const useClientMode = typeof onSearch === "function"
  const status = useClientMode ? initialStatus : (searchParams.get("payoutStatus") ?? "all")
  const isPending = isPendingProp ?? isPendingTransition

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const st = (fd.get("payoutStatus") as string)?.trim() || "all"
    if (onSearch) {
      onSearch(st)
      return
    }
    const next = new URLSearchParams(searchParams.toString())
    if (st !== "all") next.set("payoutStatus", st)
    else next.delete("payoutStatus")
    next.set("payoutPage", "1")
    startTransition(() => {
      router.push(`/driver/wallet?${next.toString()}`)
    })
  }

  const handleReset = () => {
    if (onSearch) {
      onSearch("all")
      return
    }
    const next = new URLSearchParams(searchParams.toString())
    next.delete("payoutStatus")
    next.delete("payoutPage")
    startTransition(() => {
      router.push(`/driver/wallet?${next.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
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

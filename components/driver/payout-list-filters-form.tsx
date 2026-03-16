"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "requested", label: "요청됨" },
  { value: "on_hold", label: "보류" },
  { value: "approved", label: "승인" },
  { value: "transferred", label: "이체완료" },
  { value: "rejected", label: "반려" },
  { value: "failed", label: "실패" },
]

export function PayoutListFiltersForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const status = searchParams.get("payoutStatus") ?? "all"

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const st = (fd.get("payoutStatus") as string)?.trim() || "all"
    const next = new URLSearchParams(searchParams.toString())
    if (st !== "all") next.set("payoutStatus", st)
    else next.delete("payoutStatus")
    next.set("payoutPage", "1")
    startTransition(() => {
      router.push(`/driver/wallet?${next.toString()}`)
    })
  }

  const handleReset = () => {
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
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "조회 중…" : "조회"}</Button>
      <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={isPending}>초기화</Button>
    </form>
  )
}

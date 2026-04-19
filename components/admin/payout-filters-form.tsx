"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "requested", label: "요청" },
  { value: "on_hold", label: "보류" },
  { value: "approved", label: "승인" },
  { value: "transferred", label: "이체완료" },
  { value: "rejected", label: "반려" },
  { value: "failed", label: "실패" },
]

export function PayoutFiltersForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const dateFrom = searchParams.get("dateFrom") ?? ""
  const dateTo = searchParams.get("dateTo") ?? ""
  const status = searchParams.get("status") ?? "all"
  const driverName = searchParams.get("driverName") ?? ""

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const next = new URLSearchParams()
    const from = (fd.get("dateFrom") as string)?.trim()
    const to = (fd.get("dateTo") as string)?.trim()
    const st = (fd.get("status") as string)?.trim() || "all"
    const name = (fd.get("driverName") as string)?.trim()
    if (from) next.set("dateFrom", from)
    if (to) next.set("dateTo", to)
    if (st && st !== "all") next.set("status", st)
    if (name) next.set("driverName", name)
    startTransition(() => {
      router.push(`/admin/payouts${next.toString() ? `?${next.toString()}` : ""}`)
    })
  }

  const handleReset = () => {
    startTransition(() => {
      router.push("/admin/payouts")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="list-item-card flex flex-wrap items-end gap-4 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="dateFrom">요청일자(시작)</Label>
        <Input
          id="dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={dateFrom}
          className="w-[160px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dateTo">요청일자(끝)</Label>
        <Input
          id="dateTo"
          name="dateTo"
          type="date"
          defaultValue={dateTo}
          className="w-[160px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="driverName">기사명</Label>
        <Input
          id="driverName"
          name="driverName"
          type="text"
          placeholder="이름 또는 이메일"
          defaultValue={driverName}
          className="w-[180px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status">상태</Label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="flex h-9 w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "조회 중…" : "조회"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={isPending}>
          초기화
        </Button>
      </div>
    </form>
  )
}

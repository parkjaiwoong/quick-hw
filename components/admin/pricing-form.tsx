"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { updatePricingConfigWithState } from "@/lib/actions/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type PricingFormState = {
  status: "idle" | "success" | "error"
  message?: string
}

interface PricingFormProps {
  baseFee: number
  perKmFee: number
  platformCommissionRate: number
  minDriverFee: number
  includedDistanceKm: number
}

const initialState: PricingFormState = { status: "idle" }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "저장 중..." : "가격 정책 저장"}
    </Button>
  )
}

export function PricingForm({
  baseFee,
  perKmFee,
  platformCommissionRate,
  minDriverFee,
  includedDistanceKm,
}: PricingFormProps) {
  const [state, formAction] = useActionState(updatePricingConfigWithState, initialState)

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="base_fee">기본 요금 (원)</Label>
          <Input id="base_fee" name="base_fee" type="number" defaultValue={baseFee} min={0} step="1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="per_km_fee">km당 요금 (원)</Label>
          <Input id="per_km_fee" name="per_km_fee" type="number" defaultValue={perKmFee} min={0} step="1" />
        </div>
        <div className="space-y-2">
          <Label>기본 거리 포함 (km)</Label>
          <Input value={includedDistanceKm} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform_commission_rate">플랫폼 수수료율 (%)</Label>
          <Input
            id="platform_commission_rate"
            name="platform_commission_rate"
            type="number"
            defaultValue={platformCommissionRate}
            min={0}
            step="0.1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="min_driver_fee">최소 배송원 수익 (원)</Label>
          <Input
            id="min_driver_fee"
            name="min_driver_fee"
            type="number"
            defaultValue={minDriverFee}
            min={0}
            step="1"
          />
        </div>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-semibold mb-4">수수료/사용료 정책 (분리 관리)</p>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-2">
            <Label>고객 수수료 (%)</Label>
            <Input value={0} disabled />
          </div>
          <div className="space-y-2">
            <Label>기사 수수료 (%)</Label>
            <Input value={0} disabled />
          </div>
          <div className="space-y-2">
            <Label>프로그램 사용료 (원)</Label>
            <Input value={0} disabled />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          현재는 0으로 유지되며, 추후 정책 적용 시 분리 관리 가능합니다.
        </p>
      </div>
      <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
        현재 계산식: 기본요금 + max(0, 거리 - {includedDistanceKm}km) × km당 요금
      </div>
      {state.status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.message || "저장에 실패했습니다. 다시 시도해주세요."}
        </div>
      )}
      {state.status === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          저장되었습니다.
        </div>
      )}
      <SubmitButton />
    </form>
  )
}

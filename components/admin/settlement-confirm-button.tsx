"use client"
 
 import { useTransition } from "react"
 import { toast } from "sonner"
 import { Button } from "@/components/ui/button"
 import { confirmSettlement } from "@/lib/actions/finance"
 
interface SettlementConfirmButtonProps {
  settlementId: string
  disabled?: boolean
  helperText?: string
}
 
export function SettlementConfirmButton({ settlementId, disabled, helperText }: SettlementConfirmButtonProps) {
   const [isPending, startTransition] = useTransition()
 
   const handleClick = () => {
    if (disabled) return
     startTransition(async () => {
       const result = await confirmSettlement(settlementId)
       if ("error" in result && result.error) {
         toast.error(result.error)
         return
       }
       toast.success("정산 확정 완료: 기사 출금 가능 금액으로 이동됨")
     })
   }
 
   return (
    <div className="mt-2 space-y-1">
      <Button size="sm" disabled={isPending || disabled} onClick={handleClick} title={helperText}>
        {isPending ? "확정 중..." : "정산 확정"}
      </Button>
      {disabled && helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
   )
 }

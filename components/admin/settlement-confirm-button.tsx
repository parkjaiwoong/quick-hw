"use client"
 
 import { useTransition } from "react"
 import { toast } from "sonner"
 import { Button } from "@/components/ui/button"
 import { confirmSettlement } from "@/lib/actions/finance"
 
 interface SettlementConfirmButtonProps {
   settlementId: string
 }
 
 export function SettlementConfirmButton({ settlementId }: SettlementConfirmButtonProps) {
   const [isPending, startTransition] = useTransition()
 
   const handleClick = () => {
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
     <Button size="sm" className="mt-2" disabled={isPending} onClick={handleClick}>
       {isPending ? "확정 중..." : "정산 확정"}
     </Button>
   )
 }

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function CustomerDeliveryDetailShell() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Button asChild variant="outline">
        <Link href="/customer" prefetch>
          ← 돌아가기
        </Link>
      </Button>
      <div className="flex-1">
        <h1 className="text-2xl font-bold">배송 추적</h1>
        <p className="text-sm text-muted-foreground">배송 상태를 확인하세요</p>
      </div>
    </div>
  )
}

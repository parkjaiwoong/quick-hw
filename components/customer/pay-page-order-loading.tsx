"use client"

import { useEffect, useState, startTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Loader2 } from "lucide-react"

const RETRY_DELAY_MS = 1500
const MAX_RETRIES = 4

/**
 * 결제 페이지에서 order가 아직 없을 때 표시.
 * 주문 생성 직후 약간의 지연이 있을 수 있으므로 재시도 후 배송 상세로 안내.
 */
export function PayPageOrderLoading({ deliveryId }: { deliveryId: string }) {
  const router = useRouter()
  const [retries, setRetries] = useState(0)

  useEffect(() => {
    if (retries >= MAX_RETRIES) return
    const t = setTimeout(() => {
      setRetries((r) => r + 1)
      startTransition(() => router.refresh())
    }, RETRY_DELAY_MS)
    return () => clearTimeout(t)
  }, [retries, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              결제 정보 준비 중
            </CardTitle>
            <CardDescription>
              {retries < MAX_RETRIES
                ? "잠시만 기다려 주세요. 곧 결제 화면으로 이동합니다."
                : "결제 정보를 불러오지 못했습니다. 배송 상세에서 다시 시도해 주세요."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {retries >= MAX_RETRIES ? (
              <Button asChild className="w-full">
                <Link href={`/customer/delivery/${deliveryId}`}>배송 상세로 이동</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground text-center">새로고침 중… ({retries + 1}/{MAX_RETRIES})</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

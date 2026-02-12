"use client"

import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PaymentFailPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-lg mx-auto flex min-h-[70vh] items-center">
        <Card className="w-full">
          <CardHeader className="items-center text-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <CardTitle className="mt-2">결제가 실패했습니다</CardTitle>
            <CardDescription>결제가 정상적으로 처리되지 않았습니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => router.back()}>다시 결제하기</Button>
            <Button variant="outline" onClick={() => router.push("/customer")}>
              취소
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

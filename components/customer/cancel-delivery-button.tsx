"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cancelDelivery } from "@/lib/actions/deliveries"
import { XCircle, CreditCard, Banknote, Wallet } from "lucide-react"

interface CancelDeliveryButtonProps {
  deliveryId: string
  paymentMethod: string | null | undefined
  paymentStatus: string | null | undefined
}

function getCancelInfo(paymentMethod: string | null | undefined, paymentStatus: string | null | undefined) {
  const method = (paymentMethod || "").toLowerCase()
  const isPaid = paymentStatus === "PAID"

  if (method === "card") {
    return {
      icon: <CreditCard className="h-5 w-5 text-blue-500" />,
      title: "카드 결제 취소 안내",
      description: isPaid
        ? "카드 결제가 완료된 상태입니다. 취소 시 결제가 자동으로 환불 처리됩니다. 환불은 카드사 정책에 따라 1~5 영업일 내 처리됩니다."
        : "카드 결제 전 상태입니다. 취소 시 결제 없이 배송이 취소됩니다.",
      confirmLabel: "취소 및 환불 신청",
    }
  }

  if (method === "bank_transfer") {
    return {
      icon: <Wallet className="h-5 w-5 text-green-500" />,
      title: "계좌이체 취소 안내",
      description: isPaid
        ? "계좌이체 결제가 완료된 상태입니다. 취소 시 환불 처리가 진행됩니다. 환불 계좌 정보는 고객센터를 통해 별도 안내됩니다."
        : "계좌이체 결제 전 상태입니다. 취소 시 결제 없이 배송이 취소됩니다.",
      confirmLabel: "취소 신청",
    }
  }

  if (method === "cash") {
    return {
      icon: <Banknote className="h-5 w-5 text-yellow-500" />,
      title: "현금 결제 취소 안내",
      description:
        "현금 결제(기사 직접 수령) 방식입니다. 취소 시 기사에게 직접 연락하여 현금 반환을 요청하세요. 이미 기사가 픽업한 경우 고객센터로 문의해 주세요.",
      confirmLabel: "배송 취소",
    }
  }

  return {
    icon: <XCircle className="h-5 w-5 text-gray-500" />,
    title: "배송 취소 확인",
    description: "배송을 취소하시겠습니까? 취소 후에는 되돌릴 수 없습니다.",
    confirmLabel: "취소 확인",
  }
}

export function CancelDeliveryButton({
  deliveryId,
  paymentMethod,
  paymentStatus,
}: CancelDeliveryButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const info = getCancelInfo(paymentMethod, paymentStatus)

  async function handleCancel() {
    setLoading(true)
    setError(null)
    try {
      const result = await cancelDelivery(deliveryId)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        router.push("/customer")
      }
    } catch {
      setError("취소 처리 중 오류가 발생했습니다")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="w-full" disabled={loading}>
            <XCircle className="h-4 w-4 mr-2" />
            {loading ? "취소 처리 중…" : "배송 취소"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {info.icon}
              {info.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {info.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>돌아가기</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "처리 중…" : info.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

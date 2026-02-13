import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getOrderPaymentSummaryByDelivery } from "@/lib/actions/finance"
import { TossPaymentButton } from "@/components/customer/toss-payment-button"
import { PayPageOrderLoading } from "@/components/customer/pay-page-order-loading"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CreditCard } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DeliveryPayPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const deliveryId = typeof (params as { id?: string }).id === "string"
    ? (params as { id: string }).id
    : (await (params as Promise<{ id: string }>))?.id
  if (!deliveryId) redirect("/customer")

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, customer_id, total_fee")
    .eq("id", deliveryId)
    .eq("customer_id", user.id)
    .maybeSingle()

  if (!delivery || delivery.customer_id !== user.id) redirect("/customer")

  const { order, payment } = await getOrderPaymentSummaryByDelivery(deliveryId)
  const isCard = (payment?.payment_method || order?.payment_method) === "card"
  const amount = Number(payment?.amount ?? order?.order_amount ?? 0)
  const canPay = amount > 0 && payment?.status !== "PAID"

  // 주문이 아직 없으면 재시도 화면 표시 (배송 생성 직후 지연 시)
  if (!order?.id) {
    return <PayPageOrderLoading deliveryId={deliveryId} />
  }
  if (!isCard || !canPay) {
    redirect(`/customer/delivery/${deliveryId}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              결제하기
            </CardTitle>
            <CardDescription>
              결제를 완료한 뒤 배송 상세(기사 배정 대기)로 이동합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">결제 금액</span>
              <span className="font-semibold">{amount.toLocaleString()}원</span>
            </div>
            <TossPaymentButton
              orderId={order.id}
              amount={amount}
              disabled={false}
              autoPay
            />
          </CardContent>
        </Card>
        <Button variant="ghost" asChild className="w-full">
          <Link href={`/customer/delivery/${deliveryId}`}>나중에 결제하고 배송 상세로</Link>
        </Button>
      </div>
    </div>
  )
}

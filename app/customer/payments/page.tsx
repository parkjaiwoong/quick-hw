import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import { getMyPayments } from "@/lib/actions/finance"
import { CreditCard, MapPin, TrendingUp, TrendingDown, Minus, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PaymentFilterBar, type PaymentTab } from "@/components/customer/payment-month-picker"

export const dynamic = "force-dynamic"

// ────────────────────────────────────────────────
// 상수 / 헬퍼
// ────────────────────────────────────────────────
const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  READY:    { label: "결제 대기",  color: "bg-yellow-100 text-yellow-800" },
  PENDING:  { label: "결제 대기",  color: "bg-yellow-100 text-yellow-800" },
  PAID:     { label: "결제 완료",  color: "bg-green-100 text-green-800" },
  FAILED:   { label: "결제 실패",  color: "bg-red-100 text-red-800" },
  CANCELED: { label: "결제 취소",  color: "bg-gray-100 text-gray-800" },
  REFUNDED: { label: "환불 완료",  color: "bg-blue-100 text-blue-800" },
}

const paymentMethodLabel: Record<string, string> = {
  card:          "카드",
  bank_transfer: "계좌이체",
  cash:          "현금",
}

function formatKRW(amount: number) {
  return amount.toLocaleString("ko-KR") + "원"
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function getMonthLabel(key: string) {
  const [year, month] = key.split("-")
  return `${year}년 ${Number(month)}월`
}

const VALID_TABS: PaymentTab[] = ["all", "paid", "pending", "cancelled"]

type Payment = {
  id: string
  amount: number
  status: string
  payment_method: string | null
  pg_provider: string | null
  paid_at: string | null
  requested_at: string | null
  canceled_at: string | null
  refunded_at: string | null
  refunded_amount: number | null
  created_at: string
  delivery: {
    id: string
    pickup_address: string
    delivery_address: string
    distance_km: number | null
    total_fee: number
    status: string
  } | null
}

// ────────────────────────────────────────────────
// 페이지
// ────────────────────────────────────────────────
export default async function CustomerPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string; tab?: string }>
}) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: profile }, roleOverride, { payments }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
    getMyPayments(),
  ])

  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" ||
    profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) redirect("/")

  const allPayments = (payments ?? []) as Payment[]

  // ── 현재 년월 (기본값) ──
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // ── searchParams 파싱 ──
  const sp           = searchParams ? await searchParams : {}
  const selectedMonth: string    = sp?.month ?? currentMonthKey
  const rawTab                   = sp?.tab ?? "all"
  const selectedTab: PaymentTab  = VALID_TABS.includes(rawTab as PaymentTab)
    ? (rawTab as PaymentTab)
    : "all"

  // ── 결제 완료 건에서 존재하는 월 목록 ──
  const paidAll = allPayments.filter((p) => p.status === "PAID")
  const monthSet = new Set(paidAll.map((p) => getMonthKey(p.created_at)))
  monthSet.add(currentMonthKey)
  const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a))

  // ── 선택 월 기준 분류 ──
  const byMonth = (p: Payment) => getMonthKey(p.created_at) === selectedMonth

  const monthAll       = allPayments.filter(byMonth)
  const monthPaid      = allPayments.filter((p) => byMonth(p) && p.status === "PAID")
  const monthPending   = allPayments.filter((p) => byMonth(p) && (p.status === "READY" || p.status === "PENDING"))
  const monthCancelled = allPayments.filter((p) => byMonth(p) && (p.status === "CANCELED" || p.status === "REFUNDED"))

  // ── 탭에 따라 표시할 목록 ──
  const displayMap: Record<PaymentTab, Payment[]> = {
    all:       monthAll,
    paid:      monthPaid,
    pending:   monthPending,
    cancelled: monthCancelled,
  }
  const displayList = displayMap[selectedTab]

  // ── 통계 ──
  const selectedTotal = monthPaid.reduce((s, p) => s + Number(p.amount), 0)

  const [selYear, selMon] = selectedMonth.split("-").map(Number)
  const prevMonthDate  = new Date(selYear, selMon - 2, 1)
  const prevMonthKey   = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`
  const prevMonthPaid  = paidAll.filter((p) => getMonthKey(p.created_at) === prevMonthKey)
  const prevMonthTotal = prevMonthPaid.reduce((s, p) => s + Number(p.amount), 0)
  const monthDiff      = selectedTotal - prevMonthTotal

  const counts: Record<PaymentTab, number> = {
    all:       monthAll.length,
    paid:      monthPaid.length,
    pending:   monthPending.length,
    cancelled: monthCancelled.length,
  }

  const emptyMessages: Record<PaymentTab, string> = {
    all:       `${getMonthLabel(selectedMonth)} 결제 내역이 없습니다`,
    paid:      `${getMonthLabel(selectedMonth)} 결제 완료 내역이 없습니다`,
    pending:   `${getMonthLabel(selectedMonth)} 결제 대기 내역이 없습니다`,
    cancelled: `${getMonthLabel(selectedMonth)} 취소/환불 내역이 없습니다`,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/customer">
              <ArrowLeft className="h-4 w-4 mr-1" />
              돌아가기
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">결제 내역</h1>
            <p className="text-sm text-muted-foreground">이용 금액과 결제 상태를 확인하세요</p>
          </div>
        </div>

        {/* 월 선택 + 탭 필터 */}
        <Suspense fallback={null}>
          <PaymentFilterBar
            selectedMonth={selectedMonth}
            availableMonths={availableMonths}
            selectedTab={selectedTab}
            counts={counts}
          />
        </Suspense>

        {/* 선택 달 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{getMonthLabel(selectedMonth)} 이용금액</CardDescription>
              <CardTitle className="text-2xl text-primary">{formatKRW(selectedTotal)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{monthPaid.length}건 이용</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{getMonthLabel(prevMonthKey)} 이용금액</CardDescription>
              <CardTitle className="text-2xl">{formatKRW(prevMonthTotal)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{prevMonthPaid.length}건 이용</p>
            </CardContent>
          </Card>

          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription>전월 대비</CardDescription>
              <CardTitle className={`text-2xl flex items-center gap-1 ${monthDiff > 0 ? "text-red-600" : monthDiff < 0 ? "text-green-600" : ""}`}>
                {monthDiff > 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : monthDiff < 0 ? (
                  <TrendingDown className="h-5 w-5" />
                ) : (
                  <Minus className="h-5 w-5 text-muted-foreground" />
                )}
                {monthDiff === 0 ? "동일" : `${Math.abs(monthDiff).toLocaleString()}원`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {monthDiff > 0 ? "전월보다 더 사용" : monthDiff < 0 ? "전월보다 절약" : "전월과 동일"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 결제 목록 */}
        {displayList.length === 0 ? (
          <EmptyState message={emptyMessages[selectedTab]} />
        ) : (
          <div className="space-y-3">
            {displayList.map((p) => <PaymentCard key={p.id} payment={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────
// 서브 컴포넌트
// ────────────────────────────────────────────────
function PaymentCard({ payment }: { payment: Payment }) {
  const cfg    = paymentStatusConfig[payment.status] ?? { label: payment.status, color: "bg-gray-100 text-gray-800" }
  const method = paymentMethodLabel[payment.payment_method ?? ""] ?? payment.payment_method ?? "-"
  const eventDate =
    payment.status === "PAID"     ? payment.paid_at :
    payment.status === "CANCELED" ? payment.canceled_at :
    payment.status === "REFUNDED" ? payment.refunded_at :
    payment.requested_at ?? payment.created_at

  return (
    <div className="border rounded-lg p-4 bg-white hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cfg.color}>{cfg.label}</Badge>
            <span className="text-xs text-muted-foreground">{method}</span>
            <span className="text-xs text-muted-foreground">{formatDate(eventDate)}</span>
          </div>
          {payment.delivery && (
            <div className="space-y-1">
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                <span className="truncate">{payment.delivery.pickup_address}</span>
              </div>
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                <span className="truncate">{payment.delivery.delivery_address}</span>
              </div>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-bold ${payment.status === "CANCELED" || payment.status === "REFUNDED" ? "line-through text-muted-foreground" : ""}`}>
            {formatKRW(Number(payment.amount))}
          </p>
          {payment.status === "REFUNDED" && payment.refunded_amount != null && (
            <p className="text-xs text-blue-600 font-medium">환불 {formatKRW(Number(payment.refunded_amount))}</p>
          )}
          {payment.delivery && (
            <p className="text-xs text-muted-foreground">{payment.delivery.distance_km?.toFixed(1)}km</p>
          )}
        </div>
      </div>
      {payment.delivery && (
        <div className="mt-3 pt-3 border-t">
          <Button asChild variant="outline" size="sm" className="w-full bg-transparent text-xs h-8">
            <Link href={`/customer/delivery/${payment.delivery.id}`}>배송 상세 보기</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function EmptyState({ message = "결제 내역이 없습니다" }: { message?: string }) {
  return (
    <div className="text-center py-12">
      <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{message}</p>
      <p className="text-xs text-muted-foreground mt-1">배송 이용 후 결제 내역이 표시됩니다</p>
    </div>
  )
}

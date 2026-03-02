"use client"

import { useState } from "react"
import type { Delivery } from "@/lib/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, Package, History, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import Link from "next/link"

type DeliveryListItem = Delivery & {
  orders?: Array<{ order_amount?: number; order_status?: string; payment_method?: string }>
  payments?: Array<{ status?: string; amount?: number; payment_method?: string }>
}

interface DeliveryListProps {
  deliveries: DeliveryListItem[]
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending:    { label: "대기중",   color: "bg-yellow-100 text-yellow-800" },
  accepted:   { label: "수락됨",   color: "bg-blue-100 text-blue-800" },
  picked_up:  { label: "픽업완료", color: "bg-indigo-100 text-indigo-800" },
  in_transit: { label: "배송중",   color: "bg-purple-100 text-purple-800" },
  delivered:  { label: "완료",     color: "bg-green-100 text-green-800" },
  cancelled:  { label: "취소됨",   color: "bg-gray-100 text-gray-800" },
}

const paymentStatusLabel: Record<string, string> = {
  READY:    "결제 대기",
  PENDING:  "결제 대기",
  PAID:     "결제 완료",
  FAILED:   "결제 실패",
  CANCELED: "결제 취소",
  REFUNDED: "환불 완료",
}

const ACTIVE_STATUSES  = ["pending", "accepted", "picked_up", "in_transit"]
const HISTORY_STATUSES = ["delivered", "cancelled"]
const PAGE_SIZE = 5

function DeliveryCard({ delivery }: { delivery: DeliveryListItem }) {
  const cfg = statusConfig[delivery.status] ?? { label: delivery.status, color: "bg-gray-100 text-gray-800" }
  return (
    <div className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge className={cfg.color}>{cfg.label}</Badge>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true, locale: ko })}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm min-w-0">
                <p className="font-medium">출발지</p>
                <p className="text-muted-foreground truncate">{delivery.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm min-w-0">
                <p className="font-medium">도착지</p>
                <p className="text-muted-foreground truncate">{delivery.delivery_address}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="text-right ml-3 shrink-0">
          <p className="text-xl font-bold">{delivery.total_fee.toLocaleString()}원</p>
          <p className="text-xs text-muted-foreground">{delivery.distance_km?.toFixed(1)}km</p>
          {delivery.payments?.[0]?.status && (
            <p className="text-xs text-muted-foreground mt-1">
              {paymentStatusLabel[delivery.payments[0].status] || delivery.payments[0].status}
            </p>
          )}
          {delivery.payments?.[0]?.payment_method && (
            <p className="text-xs text-muted-foreground">결제: {delivery.payments[0].payment_method}</p>
          )}
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="w-full bg-transparent">
        <Link href={`/customer/delivery/${delivery.id}`}>상세보기</Link>
      </Button>
    </div>
  )
}

function EmptyState({ type }: { type: "active" | "history" }) {
  return (
    <div className="text-center py-10">
      {type === "active" ? (
        <>
          <Loader2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">진행 중인 배송이 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">새 배송을 요청해보세요</p>
          <Button asChild className="mt-4" size="sm">
            <Link href="/customer/new-delivery">배송 요청하기</Link>
          </Button>
        </>
      ) : (
        <>
          <History className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">완료된 배송 내역이 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">배송이 완료되면 여기에 표시됩니다</p>
        </>
      )}
    </div>
  )
}

interface PaginatorProps {
  page: number
  totalPages: number
  total: number
  onPrev: () => void
  onNext: () => void
  onPage: (p: number) => void
}

function Paginator({ page, totalPages, total, onPrev, onNext, onPage }: PaginatorProps) {
  if (totalPages <= 1) return null

  // 최대 5개 페이지 번호 표시
  const getPageNumbers = () => {
    const delta = 2
    const start = Math.max(1, page - delta)
    const end   = Math.min(totalPages, page + delta)
    const pages: number[] = []
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div className="flex items-center justify-between pt-3 border-t mt-3">
      <p className="text-xs text-muted-foreground">
        전체 {total}건 · {page}/{totalPages} 페이지
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page === 1}
          onClick={onPrev}
          aria-label="이전 페이지"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageNumbers().map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon"
            className="h-7 w-7 text-xs"
            onClick={() => onPage(p)}
            aria-label={`${p}페이지`}
          >
            {p}
          </Button>
        ))}

        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page === totalPages}
          onClick={onNext}
          aria-label="다음 페이지"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function DeliveryList({ deliveries }: DeliveryListProps) {
  const [historyPage, setHistoryPage] = useState(1)

  const active  = deliveries.filter((d) => ACTIVE_STATUSES.includes(d.status))
  const history = deliveries.filter((d) => HISTORY_STATUSES.includes(d.status))

  const totalHistoryPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE))
  const pagedHistory = history.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE)

  function handleTabChange(value: string) {
    // 히스토리 탭으로 돌아올 때 1페이지로 리셋하지 않음 (UX: 보던 페이지 유지)
    if (value === "active") setHistoryPage(1)
  }

  return (
    <Tabs defaultValue="active" onValueChange={handleTabChange}>
      <TabsList className="w-full mb-4">
        <TabsTrigger value="active" className="flex-1 gap-1.5">
          <Package className="h-4 w-4" />
          진행 중
          {active.length > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 leading-none">
              {active.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="history" className="flex-1 gap-1.5">
          <History className="h-4 w-4" />
          히스토리
          {history.length > 0 && (
            <span className="ml-1 rounded-full bg-muted text-muted-foreground text-xs px-1.5 py-0.5 leading-none">
              {history.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="mt-0">
        {active.length === 0 ? (
          <EmptyState type="active" />
        ) : (
          <div className="space-y-3">
            {active.map((d) => <DeliveryCard key={d.id} delivery={d} />)}
          </div>
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-0">
        {history.length === 0 ? (
          <EmptyState type="history" />
        ) : (
          <>
            <div className="space-y-3">
              {pagedHistory.map((d) => <DeliveryCard key={d.id} delivery={d} />)}
            </div>
            <Paginator
              page={historyPage}
              totalPages={totalHistoryPages}
              total={history.length}
              onPrev={() => setHistoryPage((p) => Math.max(1, p - 1))}
              onNext={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
              onPage={(p) => setHistoryPage(p)}
            />
          </>
        )}
      </TabsContent>
    </Tabs>
  )
}

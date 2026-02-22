"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type RecentDelivery = {
  id: string
  pickup_address: string
  delivery_address: string
  status: string
  created_at: string
}

type RecentAccident = {
  id: string
  accident_type: string
  status: string
  created_at: string
}

type RecentInquiry = {
  id: string
  title?: string | null
  message?: string | null
  created_at: string
  is_read?: boolean | null
}

type AdminDashboardTabsProps = {
  recentDeliveries: RecentDelivery[] | null
  recentDeliveriesError?: string | null
  recentAccidents: RecentAccident[] | null
  recentAccidentsError?: string | null
  recentInquiries: RecentInquiry[] | null
}

export default function AdminDashboardTabs({
  recentDeliveries,
  recentDeliveriesError,
  recentAccidents,
  recentAccidentsError,
  recentInquiries,
}: AdminDashboardTabsProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <Card className="w-full overflow-hidden">
      <Tabs defaultValue="logs" className="w-full">
        <div className="border-b bg-muted/30 px-4 pt-4 pb-0 md:px-6">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">탭 메뉴</p>
          <TabsList className="tabs-scroll-mobile inline-flex w-full max-w-full h-auto min-h-[2.75rem] gap-1 rounded-xl border border-border bg-background p-1.5 shadow-sm overflow-x-auto overflow-y-hidden justify-start">
            <TabsTrigger value="logs" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">주문 & 연결 로그</TabsTrigger>
            <TabsTrigger value="accidents" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">사고 처리 관리</TabsTrigger>
            <TabsTrigger value="cs" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">CS 응대</TabsTrigger>
            <TabsTrigger value="rider-change" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">기사 변경 요청</TabsTrigger>
            <TabsTrigger value="rewards" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">리워드 관리</TabsTrigger>
            <TabsTrigger value="pricing" className="flex-none shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">가격 정책</TabsTrigger>
          </TabsList>
        </div>

        <div className="p-4 md:p-6">
      <TabsContent value="logs" className="mt-0">
        <div className="rounded-lg border bg-card p-4">
          <CardHeader>
            <CardTitle>주문 & 연결 로그</CardTitle>
            <CardDescription>
              누가 언제 누구와 연결됐는지, 통화 여부, 사고 발생 여부를 확인하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentDeliveriesError ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                주문 로그를 불러오지 못했습니다: {recentDeliveriesError}
              </div>
            ) : recentDeliveries && recentDeliveries.length > 0 ? (
              <div className="space-y-3 mb-4">
                {recentDeliveries.map((delivery) => (
                  <div key={delivery.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {delivery.pickup_address} → {delivery.delivery_address}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(delivery.created_at).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      상태:{" "}
                      {delivery.status === "pending"
                        ? "대기"
                        : delivery.status === "accepted"
                          ? "수락"
                          : delivery.status === "picked_up"
                            ? "픽업"
                            : delivery.status === "in_transit"
                              ? "배송중"
                              : delivery.status === "delivered"
                                ? "완료"
                                : delivery.status === "cancelled"
                                  ? "취소"
                                  : delivery.status}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">주문 로그가 없습니다.</p>
            )}
            <Link href="/admin/dispatch">
              <Button className="w-full">연결 로그 상세 보기</Button>
            </Link>
          </CardContent>
        </div>
      </TabsContent>

      <TabsContent value="accidents" className="mt-0">
        <div className="rounded-lg border bg-card p-4">
          <CardHeader>
            <CardTitle>사고 처리 관리</CardTitle>
            <CardDescription>
              접수 목록, 증빙 확인, 보험 처리 여부 체크, 상태 변경
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentAccidentsError ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                사고 접수 테이블이 아직 생성되지 않았습니다. Supabase에서 scripts/006_additional_features.sql 을
                실행해주세요.
              </div>
            ) : recentAccidents && recentAccidents.length > 0 ? (
              <div className="space-y-3 mb-4">
                {recentAccidents.map((accident) => (
                  <div key={accident.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">
                        사고 #{accident.id.slice(0, 8)} ·{" "}
                        {accident.accident_type === "damage" ? "물품 파손" : "물품 분실"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(accident.created_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <span className="text-xs rounded px-2 py-1 bg-muted">
                      {accident.status === "reported"
                        ? "접수"
                        : accident.status === "investigating"
                          ? "조사중"
                          : accident.status === "resolved"
                            ? "해결"
                            : "종료"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">최근 사고 접수가 없습니다.</p>
            )}
            <Link href="/admin/accidents">
              <Button className="w-full">사고 처리 상세 보기</Button>
            </Link>
          </CardContent>
        </div>
      </TabsContent>

      <TabsContent value="cs" className="mt-0">
        <div className="rounded-lg border bg-card p-4">
          <CardHeader>
            <CardTitle>CS 응대</CardTitle>
            <CardDescription>문의 목록, AI 1차 답변 기록, 필요 시 수동 응답</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInquiries && recentInquiries.length > 0 ? (
                <div className="space-y-3">
                  {recentInquiries.map((inquiry) => (
                    <div key={inquiry.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{inquiry.title || "제목 없음"}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(inquiry.created_at).toLocaleString("ko-KR")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{inquiry.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  최근 문의가 없습니다. 현재는 문의사항을 직접 확인하실 수 있습니다.
                </p>
              )}
              <Link href="/admin/inquiries">
                <Button className="w-full">문의 목록 보기</Button>
              </Link>
            </div>
          </CardContent>
        </div>
      </TabsContent>

      <TabsContent value="rider-change" className="mt-0">
        <div className="rounded-lg border bg-card p-4">
          <CardHeader>
            <CardTitle>기사 변경 요청</CardTitle>
            <CardDescription>고객이 신청한 기사 변경 요청을 확인합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/rider-change-requests">
              <Button className="w-full">기사 변경 요청 목록 보기</Button>
            </Link>
          </CardContent>
        </div>
      </TabsContent>

      <TabsContent value="rewards" className="mt-0">
        <div className="rounded-lg border bg-card p-4">
          <CardHeader>
            <CardTitle>리워드 관리</CardTitle>
            <CardDescription>정책/이력/포인트 관리 화면으로 이동합니다</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Button asChild variant="outline">
              <Link href="/admin/reward-policy">기본 리워드 정책</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/rider-reward-policy">리워드 적용 방식</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/event-policy">이벤트 리워드 관리</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/rider-rewards">주문별 리워드 정산</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/point-history">고객 포인트 내역</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/point-redemptions">포인트 교환 요청</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/referrals">고객 소개 현황</Link>
            </Button>
          </CardContent>
        </div>
      </TabsContent>

      <TabsContent value="pricing" className="mt-0">
        <div className="rounded-lg border bg-card p-4">
          <CardHeader>
            <CardTitle>가격 정책</CardTitle>
            <CardDescription>카카오픽 기준 자동 산정 정책을 관리합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/pricing">
              <Button className="w-full">가격 정책 설정</Button>
            </Link>
          </CardContent>
        </div>
      </TabsContent>
        </div>
      </Tabs>
    </Card>
  )
}

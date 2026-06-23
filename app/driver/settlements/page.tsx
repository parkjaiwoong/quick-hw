import { Suspense } from "react"
import { PageTitleShell, StatsGridSkeleton } from "@/components/ui/page-skeletons"
import { DriverSettlementsBody } from "@/components/driver/driver-settlements-body"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

function SettlementsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <StatsGridSkeleton cols={4} count={4} />
      <Card>
        <CardHeader>
          <div className="h-6 w-28 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-40 w-full rounded-lg bg-muted" />
        </CardContent>
      </Card>
    </div>
  )
}

type SearchParams = Promise<{
  error?: string
  settlementMonth?: string
  paymentMethod?: string
  status?: string
  page?: string
}>

export default async function DriverSettlementsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedParams = await searchParams

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <PageTitleShell title="정산 내역" description="나의 정산 내역을 확인하세요" />
        <Suspense fallback={<SettlementsSkeleton />}>
          <DriverSettlementsBody resolvedParams={resolvedParams} />
        </Suspense>
      </div>
    </div>
  )
}

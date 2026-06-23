import { PageTitleShell, StatsGridSkeleton } from "@/components/ui/page-skeletons"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function SettlementsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <PageTitleShell title="정산 내역" description="나의 정산 내역을 확인하세요" />
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
      </div>
    </div>
  )
}

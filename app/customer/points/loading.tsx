import { PageTitleShell, StatsGridSkeleton } from "@/components/ui/page-skeletons"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function PointsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <PageTitleShell title="포인트" description="포인트를 확인하고 사용하세요" />
        <div className="space-y-6 animate-pulse">
          <StatsGridSkeleton count={3} />
          <Card>
            <CardHeader>
              <div className="h-6 w-40 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-10 w-full rounded bg-muted" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

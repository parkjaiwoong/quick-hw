import { Card, CardContent, CardHeader } from "@/components/ui/card"

/** 고객 하위 경로 공통 — 레이아웃 유지 후 콘텐츠만 골격 */
export function CustomerRouteSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="h-10 w-48 rounded-lg bg-muted" />
      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-full max-w-md rounded bg-muted mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-24 w-full rounded-lg bg-muted" />
          <div className="h-24 w-full rounded-lg bg-muted" />
        </CardContent>
      </Card>
    </div>
  )
}

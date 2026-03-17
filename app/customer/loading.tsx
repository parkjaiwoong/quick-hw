import { Card, CardContent, CardHeader } from "@/components/ui/card"

/** 고객 메인 로딩 — 클릭 직후 골격 표시로 체감 속도 개선 */
export default function CustomerLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="text-center space-y-4 py-8">
          <div className="h-10 w-64 mx-auto animate-pulse rounded bg-muted" />
          <div className="h-6 w-48 mx-auto animate-pulse rounded bg-muted" />
        </div>
        <div className="h-14 w-full animate-pulse rounded-lg bg-muted" />
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-12 w-44 rounded-md bg-muted animate-pulse" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-8 w-12 mt-2 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-muted" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

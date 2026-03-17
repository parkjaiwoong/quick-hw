import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** 기사연결요청 화면 로딩 — 클릭 직후 골격을 바로 보여 체감 속도 개선 */
export default function NewDeliveryLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="h-7 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-10 flex-1 rounded-md bg-muted animate-pulse" />
              <div className="h-10 flex-1 rounded-md bg-muted animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

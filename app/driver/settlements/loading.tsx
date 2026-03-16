import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DriverSettlementsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <div className="h-9 w-40 bg-muted animate-pulse rounded" />
          <div className="h-5 w-56 bg-muted/70 animate-pulse rounded mt-2" />
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                <div className="h-8 w-24 bg-muted animate-pulse rounded mt-1" />
              </CardHeader>
              <CardContent className="h-4" />
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-48 bg-muted/70 animate-pulse rounded mt-1" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-full max-w-xs bg-muted/70 animate-pulse rounded" />
                <div className="h-4 w-full max-w-sm bg-muted/70 animate-pulse rounded" />
                <div className="h-6 w-20 bg-muted animate-pulse rounded mt-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

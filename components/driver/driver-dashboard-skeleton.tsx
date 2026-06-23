import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function DriverDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-48 rounded-lg bg-muted" />
          <div className="h-4 w-36 rounded bg-muted" />
        </div>
        <div className="h-24 w-full md:w-48 rounded-xl bg-muted" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-8 w-12 rounded bg-muted mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-4 w-8 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-4 w-56 rounded bg-muted mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 w-full rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

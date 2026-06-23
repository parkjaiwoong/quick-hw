import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-lg bg-muted" />
      <div className="h-16 w-full rounded-xl bg-muted" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-8 w-14 rounded bg-muted mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-4 w-6 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

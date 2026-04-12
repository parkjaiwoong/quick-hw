import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function CustomerDashboardBodySkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl bg-white border border-border/60 shadow-sm p-4 text-center animate-pulse"
          >
            <div className="h-8 w-10 mx-auto rounded bg-muted" />
            <div className="h-3 w-12 mx-auto mt-2 rounded bg-muted" />
          </div>
        ))}
      </div>
      <section>
        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden animate-pulse">
          <CardHeader className="pb-3">
            <div className="h-5 w-24 rounded bg-muted" />
            <div className="h-4 w-64 rounded bg-muted mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 w-full rounded-lg bg-muted" />
            ))}
          </CardContent>
        </Card>
      </section>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-white border border-border/60 animate-pulse" />
        ))}
      </div>
      <Card className="rounded-2xl border-border/60 overflow-hidden animate-pulse">
        <CardHeader>
          <div className="h-5 w-28 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-16 w-full rounded-lg bg-muted" />
          <div className="h-10 w-40 rounded-lg bg-muted" />
        </CardContent>
      </Card>
    </div>
  )
}

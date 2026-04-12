import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function DriverRouteSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="h-9 w-56 rounded-lg bg-muted" />
      <Card>
        <CardHeader>
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-20 w-full rounded-lg bg-muted" />
          <div className="h-20 w-full rounded-lg bg-muted" />
        </CardContent>
      </Card>
    </div>
  )
}

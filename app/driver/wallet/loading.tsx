import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DriverWalletLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <div className="h-9 w-48 bg-muted animate-pulse rounded" />
          <div className="h-5 w-64 bg-muted/70 animate-pulse rounded mt-2" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-28 bg-muted animate-pulse rounded mt-1" />
              </CardHeader>
              <CardContent className="h-4" />
            </Card>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
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
            <div className="h-6 w-40 bg-muted animate-pulse rounded" />
            <div className="h-4 w-56 bg-muted/70 animate-pulse rounded mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-24 bg-muted/70 animate-pulse rounded" />
                <div className="h-4 w-16 bg-muted/70 animate-pulse rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-full max-w-sm bg-muted/70 animate-pulse rounded mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-10 w-full max-w-md bg-muted/70 animate-pulse rounded" />
            <div className="h-10 w-full max-w-md bg-muted/70 animate-pulse rounded" />
            <div className="h-10 w-24 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

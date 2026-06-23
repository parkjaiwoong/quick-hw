import { Card, CardContent, CardHeader } from "@/components/ui/card"

/** 카드 안 폼 필드 골격 (외부 Card 없음) */
export function FormFieldsSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="px-6 pb-6 space-y-4 animate-pulse">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted" />
        </div>
      ))}
      <div className="h-10 w-full rounded-md bg-muted mt-2" />
    </div>
  )
}

/** 폼/카드 페이지 공통 골격 */
export function FormCardSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-4 w-64 rounded bg-muted mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-10 w-full rounded-md bg-muted" />
          </div>
        ))}
        <div className="h-10 w-full rounded-md bg-muted mt-2" />
      </CardContent>
    </Card>
  )
}

/** 상세 페이지 헤더 + 카드 골격 */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-10 w-24 rounded-md bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-40 rounded bg-muted" />
          <div className="h-4 w-56 rounded bg-muted" />
        </div>
      </div>
      <div className="h-64 w-full rounded-xl bg-muted" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="h-6 w-28 rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-20 w-full rounded-lg bg-muted" />
            <div className="h-20 w-full rounded-lg bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 w-28 rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-16 w-full rounded-lg bg-muted" />
            <div className="h-16 w-full rounded-lg bg-muted" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** 통계 카드 3열 골격 */
export function StatsGridSkeleton({ cols = 3, count = 3 }: { cols?: number; count?: number }) {
  const gridClass =
    cols === 4 ? "grid grid-cols-2 md:grid-cols-4 gap-4" : "grid md:grid-cols-3 gap-4"
  return (
    <div className={`${gridClass} animate-pulse`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-8 w-16 rounded bg-muted mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-4 w-6 rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** 페이지 제목만 즉시 표시 */
export function PageTitleShell({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-balance">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
    </div>
  )
}

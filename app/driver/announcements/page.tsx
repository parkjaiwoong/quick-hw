import { Suspense } from "react"
import { PageTitleShell } from "@/components/ui/page-skeletons"
import { DriverAnnouncementsBody } from "@/components/driver/driver-announcements-body"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

function DriverAnnouncementsSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="h-6 w-28 rounded bg-muted" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 w-full rounded-lg bg-muted" />
        ))}
      </CardContent>
    </Card>
  )
}

export default function DriverAnnouncementsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitleShell title="공지사항" description="중요한 안내 사항을 확인하세요" />
      <Suspense fallback={<DriverAnnouncementsSkeleton />}>
        <DriverAnnouncementsBody />
      </Suspense>
    </div>
  )
}

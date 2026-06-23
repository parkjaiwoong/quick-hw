import { PageTitleShell } from "@/components/ui/page-skeletons"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function AnnouncementsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <PageTitleShell title="공지사항" description="중요한 안내 사항을 확인하세요" />
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 w-28 rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 w-full rounded-lg bg-muted" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Pin } from "lucide-react"
import { getAnnouncements } from "@/lib/actions/announcements"

export default async function DriverAnnouncementsPage() {
  const { data: announcements, error } = await getAnnouncements("driver")

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-balance">공지사항</h1>
        <p className="text-muted-foreground mt-1">중요한 안내 사항을 확인하세요</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>공지 목록</CardTitle>
          <CardDescription>플랫폼 운영 관련 공지사항입니다</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              공지사항을 불러오지 못했습니다.
            </p>
          ) : !announcements || announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">등록된 공지사항이 없습니다</p>
          ) : (
            <div className="space-y-4">
              {announcements.map((a) => (
                <article
                  key={a.id}
                  className="rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {a.is_pinned && <Pin className="h-4 w-4 shrink-0 text-amber-500" />}
                    <h2 className="font-semibold text-lg">{a.title}</h2>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                    {a.content}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("ko-KR")}
                  </p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getRoleOverride } from "@/lib/role"
import { getAnnouncements } from "@/lib/actions/announcements"
import { AnnouncementForm } from "@/components/admin/announcement-form"
import { AnnouncementList } from "@/components/admin/announcement-list"

export default async function AdminAnnouncementsPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const [{ data: profile }, roleOverride] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
  ])
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) redirect("/")

  const { data: announcements, error } = await getAnnouncements()

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">공지사항 관리</h1>
          <p className="text-muted-foreground mt-1">고객·기사에게 보여질 공지사항을 등록합니다</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>공지사항 등록</CardTitle>
            <CardDescription>제목과 내용을 입력한 뒤 저장합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <AnnouncementForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>등록된 공지사항</CardTitle>
            <CardDescription>수정·삭제는 각 행에서 진행합니다</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                announcements 테이블이 없습니다. Supabase에서 scripts/069_announcements.sql 을 실행해주세요.
              </div>
            ) : (
              <AnnouncementList announcements={announcements ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

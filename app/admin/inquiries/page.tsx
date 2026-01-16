import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, CheckCircle, Clock } from "lucide-react"
import { getRoleOverride } from "@/lib/role"

export default async function InquiriesPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  // 문의 목록 가져오기 (notifications 테이블에서 type이 inquiry인 것들)
  // 실제로는 별도의 inquiries 테이블이 있을 수 있지만, 현재는 notifications를 사용
  const { data: inquiries } = await supabase
    .from("notifications")
    .select(`
      id,
      user_id,
      title,
      message,
      type,
      is_read,
      created_at,
      profiles!notifications_user_id_fkey(full_name, email)
    `)
    .eq("type", "inquiry")
    .order("created_at", { ascending: false })
    .limit(100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">CS 응대</h1>
            <p className="text-muted-foreground mt-1">
              문의 목록, AI 1차 답변 기록, 필요 시 수동 응답
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              문의 목록
            </CardTitle>
            <CardDescription>
              고객 문의사항을 확인하고 응답하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>접수 시간</TableHead>
                  <TableHead>고객</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead>내용</TableHead>
                  <TableHead>처리 상태</TableHead>
                  <TableHead>AI 답변</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries && inquiries.length > 0 ? (
                  inquiries.map((inquiry: any) => (
                    <TableRow key={inquiry.id}>
                      <TableCell>
                        {new Date(inquiry.created_at).toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell>
                        {inquiry.profiles?.full_name || inquiry.profiles?.email || "알 수 없음"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {inquiry.title || "제목 없음"}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {inquiry.message}
                      </TableCell>
                      <TableCell>
                        {inquiry.is_read ? (
                          <Badge variant="default" className="flex items-center gap-1 w-fit">
                            <CheckCircle className="h-3 w-3" />
                            처리됨
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Clock className="h-3 w-3" />
                            대기중
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">준비중</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">문의사항이 없습니다</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>AI 답변 기능</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              AI 1차 답변 기능은 준비 중입니다. 현재는 문의사항을 직접 확인하고 수동으로 응답하실 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


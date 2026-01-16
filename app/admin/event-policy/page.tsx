import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getRoleOverride } from "@/lib/role"
import { createEventPolicy, getEventPolicies, syncEventPolicyStatus, updateEventStatus } from "@/lib/actions/event-policy"

export default async function EventPolicyPage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  await syncEventPolicyStatus()
  const { events } = await getEventPolicies()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">이벤트 리워드</h1>
            <p className="text-muted-foreground mt-1">기간/중복 여부 관리</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>이벤트 리워드 관리</CardTitle>
            <CardDescription>기간/중복 여부를 설정합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createEventPolicy} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">이벤트 이름</Label>
                <Input id="name" name="name" placeholder="예: 9월 프로모션" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_reward_rate">이벤트 리워드 (%)</Label>
                <Input id="event_reward_rate" name="event_reward_rate" type="number" step="0.1" min={0} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_at">시작일</Label>
                <Input id="start_at" name="start_at" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_at">종료일</Label>
                <Input id="end_at" name="end_at" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">상태</Label>
                <select
                  id="status"
                  name="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="scheduled"
                >
                  <option value="scheduled">예약</option>
                  <option value="active">진행중</option>
                  <option value="ended">종료</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>중복 적용</Label>
                <div className="flex items-center gap-2 text-sm">
                  <input id="stackable" name="stackable" type="checkbox" defaultChecked />
                  <label htmlFor="stackable">기본 리워드와 중복 적용</label>
                </div>
              </div>
              <div className="md:col-span-2">
                <Button type="submit">이벤트 저장</Button>
              </div>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이벤트</TableHead>
                  <TableHead>리워드 %</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead>중복</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>변경</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events && events.length > 0 ? (
                  events.map((event: any) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.name}</TableCell>
                      <TableCell>{Number(event.event_reward_rate || 0) * 100}%</TableCell>
                      <TableCell>
                        {event.start_at ? new Date(event.start_at).toLocaleDateString("ko-KR") : "-"} ~{" "}
                        {event.end_at ? new Date(event.end_at).toLocaleDateString("ko-KR") : "-"}
                      </TableCell>
                      <TableCell>{event.stackable ? "중복" : "단독"}</TableCell>
                      <TableCell>{event.status}</TableCell>
                      <TableCell>
                        <form action={updateEventStatus} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={event.id} />
                          <select
                            name="status"
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            defaultValue={event.status}
                          >
                            <option value="scheduled">예약</option>
                            <option value="active">진행중</option>
                            <option value="ended">종료</option>
                          </select>
                          <Button size="sm" type="submit">
                            변경
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      등록된 이벤트가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

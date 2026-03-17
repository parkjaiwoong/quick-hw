import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, CheckCircle, Clock } from "lucide-react"
import { getRoleOverride } from "@/lib/role"
import { processPointRedemption } from "@/lib/actions/points"

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; attachment?: string; summary?: string }
}) {
  const getRequestedPoints = (message: string) => {
    const match = message.match(/요청 포인트:\s*([\d,]+)/)
    if (!match) return ""
    return match[1].replace(/,/g, "")
  }

  const getProcessingInfo = (message: string) => {
    const processor = message.match(/처리자:\s*(.+)/)?.[1]
    const processedAt = message.match(/처리일시:\s*(.+)/)?.[1]
    if (!processor && !processedAt) return "-"
    return `${processor || "-"} / ${processedAt || "-"}`
  }

  const getRequestedPointsBadge = (message: string) => {
    const match = message.match(/요청 포인트:\s*([\d,]+)/)
    if (!match) return null
    return `${match[1]}P`
  }

  const getProcessorBadge = (message: string) => {
    const match = message.match(/처리자:\s*(.+)/)?.[1]
    return match || null
  }

  const getContactValue = (message: string) => message.match(/연락처:\s*(.+)/)?.[1]?.trim() || "-"

  const getNoteValue = (message: string) => message.match(/요청 내용:\s*(.+)/)?.[1]?.trim() || "-"

  const getAttachmentUrl = (message: string) => message.match(/첨부:\s*(.+)/)?.[1]?.trim() || ""

  const buildPointHistoryLink = (profile?: { full_name?: string | null; email?: string | null }) => {
    const queryValue = profile?.email || profile?.full_name
    if (!queryValue) return "/admin/point-history"
    return `/admin/point-history?q=${encodeURIComponent(queryValue)}`
  }

  const buildToggleStatusLink = () => {
    const nextStatus = status === "pending" ? "all" : "pending"
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (nextStatus !== "pending") params.set("status", nextStatus)
    if (attachmentFilter === "missing") params.set("attachment", "missing")
    if (summaryMode) params.set("summary", "on")
    const queryString = params.toString()
    return queryString ? `/admin/inquiries?${queryString}` : "/admin/inquiries"
  }

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

  const query = searchParams?.q?.trim()
  const status =
    searchParams?.status === "done" ? "done" : searchParams?.status === "all" ? "all" : "pending"
  const attachmentFilter = searchParams?.attachment === "missing" ? "missing" : "all"
  const summaryMode = searchParams?.summary === "off" ? false : true
  let pointRequests: any[] = []

  if (query) {
    const { data: matchedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)

    const profileIds = (matchedProfiles || []).map((profile: any) => profile.id)

    if (profileIds.length) {
      let requestQuery = supabase
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
        .eq("type", "point_redemption")
        .in("user_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(100)

      if (status === "pending") {
        requestQuery = requestQuery.eq("is_read", false)
      } else if (status === "done") {
        requestQuery = requestQuery.eq("is_read", true)
      }

      const { data: requestRows } = await requestQuery
      pointRequests = requestRows || []
    }
  } else {
    let requestQuery = supabase
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
      .eq("type", "point_redemption")
      .order("created_at", { ascending: false })
      .limit(100)

    if (status === "pending") {
      requestQuery = requestQuery.eq("is_read", false)
    } else if (status === "done") {
      requestQuery = requestQuery.eq("is_read", true)
    }

    const { data: requestRows } = await requestQuery
    pointRequests = requestRows || []
  }

  const displayedRequests =
    attachmentFilter === "missing"
      ? (pointRequests || []).filter((request: any) => !getAttachmentUrl(request.message || ""))
      : pointRequests

  const buildAttachmentFilterLink = (nextFilter: "all" | "missing") => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (status !== "pending") params.set("status", status)
    if (nextFilter === "missing") params.set("attachment", "missing")
    if (summaryMode) params.set("summary", "on")
    const queryString = params.toString()
    return queryString ? `/admin/inquiries?${queryString}` : "/admin/inquiries"
  }

  const buildSummaryToggleLink = () => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (status !== "pending") params.set("status", status)
    if (attachmentFilter === "missing") params.set("attachment", "missing")
    if (summaryMode) params.set("summary", "off")
    const queryString = params.toString()
    return queryString ? `/admin/inquiries?${queryString}` : "/admin/inquiries"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">CS 응대</h1>
          <p className="text-muted-foreground mt-1">
            문의 목록, AI 1차 답변 기록, 필요 시 수동 응답
          </p>
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
          <CardContent className="space-y-4">
            <form action="/admin/inquiries" className="flex flex-col gap-2 md:flex-row md:items-end">
              <div className="flex-1">
                <Label htmlFor="point_request_search">고객 검색</Label>
                <Input
                  id="point_request_search"
                  name="q"
                  placeholder="이름 또는 이메일"
                  defaultValue={query}
                />
              </div>
              <div>
                <Label htmlFor="point_request_status">상태</Label>
                <select
                  id="point_request_status"
                  name="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={status}
                >
                  <option value="all">전체</option>
                  <option value="pending">대기중</option>
                  <option value="done">처리됨</option>
                </select>
              </div>
              <Button type="submit" variant="outline">
                검색
              </Button>
              <Button asChild variant="outline">
                <Link href={buildAttachmentFilterLink(attachmentFilter === "missing" ? "all" : "missing")}>
                  {attachmentFilter === "missing" ? "첨부 전체 보기" : "첨부 없음만 보기"}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={buildSummaryToggleLink()}>{summaryMode ? "요약 모드 끄기" : "요약 모드"}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={buildToggleStatusLink()}>
                  {status === "pending" ? "처리 완료 보기" : "처리 완료 숨기기"}
                </Link>
              </Button>
            </form>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              포인트 교환 요청
            </CardTitle>
            <CardDescription>고객이 요청한 상품권 교환 내역</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>접수 시간</TableHead>
                  <TableHead>고객</TableHead>
                  <TableHead>요청 내용</TableHead>
                  <TableHead>처리 상태</TableHead>
                  <TableHead>처리 정보</TableHead>
                  <TableHead>관련</TableHead>
                  <TableHead>처리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRequests && displayedRequests.length > 0 ? (
                  displayedRequests.map((request: any) => (
                    <TableRow
                      key={request.id}
                      className={
                        !getAttachmentUrl(request.message || "")
                          ? "bg-amber-100/70 ring-1 ring-amber-200"
                          : undefined
                      }
                    >
                      <TableCell>{new Date(request.created_at).toLocaleString("ko-KR")}</TableCell>
                      <TableCell>{request.profiles?.full_name || request.profiles?.email || "알 수 없음"}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {getRequestedPointsBadge(request.message || "") && (
                            <Badge variant="secondary">{getRequestedPointsBadge(request.message || "")}</Badge>
                          )}
                          {getProcessorBadge(request.message || "") && (
                            <Badge variant="outline">처리자: {getProcessorBadge(request.message || "")}</Badge>
                          )}
                          {!getAttachmentUrl(request.message || "") && (
                            <Badge variant="destructive">첨부 없음</Badge>
                          )}
                        </div>
                        {summaryMode && request.is_read ? (
                          <div className="text-xs text-muted-foreground">
                            연락처:{" "}
                            <span className="text-foreground">{getContactValue(request.message || "")}</span> · 첨부:{" "}
                            <span className="text-foreground">
                              {getAttachmentUrl(request.message || "") ? "있음" : "없음"}
                            </span>
                          </div>
                        ) : (
                          <div className="grid gap-1 text-xs text-muted-foreground">
                            <div>
                              연락처: <span className="text-foreground">{getContactValue(request.message || "")}</span>
                            </div>
                            <div>
                              요청 내용: <span className="text-foreground">{getNoteValue(request.message || "")}</span>
                            </div>
                            <div>
                              첨부:{" "}
                              {getAttachmentUrl(request.message || "") ? (
                                <Link
                                  href={getAttachmentUrl(request.message || "")}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 underline underline-offset-4"
                                >
                                  보기
                                </Link>
                              ) : (
                                <span className="text-foreground">-</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                      <TableCell>
                        {request.is_read ? (
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
                      <TableCell className="text-xs text-muted-foreground">
                        {getProcessingInfo(request.message || "")}
                      </TableCell>
                    <TableCell>
                      <Link
                        href={buildPointHistoryLink(request.profiles)}
                        className="text-xs text-blue-600 underline underline-offset-4"
                      >
                        포인트 내역
                      </Link>
                    </TableCell>
                      <TableCell>
                        <form action={processPointRedemption} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={request.id} />
                          <input
                            name="points"
                            type="number"
                            min={1}
                            className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs"
                            defaultValue={getRequestedPoints(request.message || "")}
                            disabled={request.is_read}
                          />
                          <Button size="sm" type="submit" disabled={request.is_read}>
                            처리
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href={buildPointHistoryLink(request.profiles)} target="_blank" rel="noreferrer">
                              내역 보기
                            </Link>
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">교환 요청이 없습니다</p>
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


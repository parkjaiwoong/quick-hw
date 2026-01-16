"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { submitInquiry } from "@/lib/actions/inquiry"

export default function InquiryPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [inquiries, setInquiries] = useState<
    { id: string; title: string | null; message: string; created_at: string; is_read: boolean }[]
  >([])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from("notifications")
        .select("id, title, message, created_at, is_read")
        .eq("user_id", user.id)
        .eq("type", "inquiry")
        .order("created_at", { ascending: false })
        .then(({ data, error: fetchError }) => {
          if (fetchError) {
            console.error("Inquiry list fetch error:", fetchError)
            return
          }
          setInquiries(data || [])
        })
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const title = String(formData.get("title") || "").trim()
    const message = String(formData.get("message") || "").trim()

    const result = await submitInquiry({ title, message })

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setIsSubmitted(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, message, created_at, is_read")
        .eq("user_id", user.id)
        .eq("type", "inquiry")
        .order("created_at", { ascending: false })
      setInquiries(data || [])
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>문의 접수 완료</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  문의가 접수되었습니다. 1영업일 내에 답변드리겠습니다.
                </AlertDescription>
              </Alert>
              {inquiries.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">내 문의 내역</h3>
                  <div className="space-y-2">
                    {inquiries.slice(0, 5).map((inquiry) => (
                      <div key={inquiry.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{inquiry.title || "제목 없음"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(inquiry.created_at).toLocaleString("ko-KR")}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-2">{inquiry.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={() => router.push("/customer")} className="w-full">
                대시보드로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>일반 문의</CardTitle>
            <CardDescription>
              서비스 이용 중 궁금한 사항이나 문의사항을 남겨주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">제목</Label>
                <Input id="title" name="title" placeholder="문의 제목을 입력하세요" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">문의 내용</Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="문의 내용을 자세히 입력해주세요"
                  rows={8}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
                  취소
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? "접수 중..." : "문의 접수"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        {inquiries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>내 문의 내역</CardTitle>
              <CardDescription>접수한 문의 내용을 확인할 수 있습니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {inquiries.map((inquiry) => (
                <div key={inquiry.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{inquiry.title || "제목 없음"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(inquiry.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-2">{inquiry.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}


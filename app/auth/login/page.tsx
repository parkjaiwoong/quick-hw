"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsPending(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    const email = (formData.get("email") as string)?.trim()
    const password = formData.get("password") as string

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        let errorMessage = authError.message
        if (authError.message.includes("Invalid login credentials")) {
          errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다."
        } else if (authError.message.includes("Email not confirmed")) {
          errorMessage = "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요."
        }
        setError(errorMessage)
        return
      }

      if (!data.user) {
        setError("로그인에 실패했습니다. 다시 시도해주세요.")
        return
      }

      if (!data.user.email_confirmed_at) {
        router.replace("/auth/verify-email")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle()

      const role = profile?.role ?? (data.user.user_metadata?.role as string | undefined) ?? "customer"
      const redirectTo =
        role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/customer"

      if (role === "customer") {
        fetch("/api/auth/post-login", { method: "POST", credentials: "include" }).catch(() => {})
      }

      router.replace(redirectTo)
      router.refresh()
    } catch {
      setError("네트워크 오류. 다시 시도해 주세요.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">퀵HW언넌 로그인</CardTitle>
          <CardDescription className="text-center">계정에 로그인하여 서비스를 이용하세요</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" placeholder="your@email.com" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">계정이 없으신가요? </span>
            <Link href="/auth/signup" className="text-primary hover:underline" prefetch>
              회원가입
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

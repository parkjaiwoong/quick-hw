"use client"

import { signUp } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Shield, Truck } from "lucide-react"
import Link from "next/link"
import { useState, useTransition, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"

function SignUpForm() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState<string>("customer")
  const [insuranceAgreed, setInsuranceAgreed] = useState(false)
  const [termsAgreed, setTermsAgreed] = useState(false)

  useEffect(() => {
    // 쿼리 파라미터에서 에러 확인
    const errorParam = searchParams.get("error")
    if (errorParam === "profile_missing") {
      setError("프로필 정보가 없습니다. 회원가입을 완료해주세요.")
    }
  }, [searchParams])

  async function handleSubmit(formData: FormData) {
    setError(null)
    
    // 배송원인 경우 보험 및 약관 동의 확인
    if (role === "driver") {
      if (!insuranceAgreed || !termsAgreed) {
        setError("보험 안내 및 약관에 동의해주세요")
        return
      }
    }
    
    formData.set("role", role)
    formData.set("insuranceAgreed", insuranceAgreed ? "true" : "false")
    
    startTransition(async () => {
      const result = await signUp(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">퀵HW 회원가입</CardTitle>
          <CardDescription className="text-center">새 계정을 만들어 서비스를 시작하세요</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">이름</Label>
              <Input id="fullName" name="fullName" type="text" placeholder="홍길동" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" placeholder="your@email.com" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">전화번호</Label>
              <Input id="phone" name="phone" type="tel" placeholder="010-1234-5678" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required minLength={6} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">가입 유형</Label>
              <Select name="role" value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">고객</SelectItem>
                  <SelectItem value="driver">배송원</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 배송원 추가 정보 */}
            {role === "driver" && (
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                <div className="space-y-2">
                  <Label htmlFor="vehicleType" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    차량 종류
                  </Label>
                  <Select name="vehicleType" required>
                    <SelectTrigger>
                      <SelectValue placeholder="차량 종류 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="motorcycle">오토바이</SelectItem>
                      <SelectItem value="car">승용차</SelectItem>
                      <SelectItem value="van">승합차</SelectItem>
                      <SelectItem value="truck">트럭</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicleNumber">차량 번호</Label>
                  <Input id="vehicleNumber" name="vehicleNumber" placeholder="12가3456" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">면허 번호</Label>
                  <Input id="licenseNumber" name="licenseNumber" placeholder="면허 번호" />
                </div>

                <Alert className="border-orange-200 bg-orange-50">
                  <Shield className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 text-sm">
                    <strong>보험 안내:</strong> 플랫폼 단체 물품 보험이 적용됩니다. 
                    보상 한도는 약관에 명시되어 있습니다.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="insuranceAgreed"
                      checked={insuranceAgreed}
                      onCheckedChange={(checked) => setInsuranceAgreed(checked === true)}
                      required
                    />
                    <Label htmlFor="insuranceAgreed" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      플랫폼 보험 적용 범위를 확인했으며 동의합니다. 
                      <Link href="/terms" className="underline ml-1">약관 보기</Link>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="termsAgreed"
                      checked={termsAgreed}
                      onCheckedChange={(checked) => setTermsAgreed(checked === true)}
                      required
                    />
                    <Label htmlFor="termsAgreed" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      서비스 이용약관에 동의합니다. 
                      <Link href="/terms" className="underline ml-1">약관 보기</Link>
                    </Label>
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "처리 중..." : "회원가입"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
            <Link href="/auth/login" className="text-primary hover:underline">
              로그인
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">퀵HW 회원가입</CardTitle>
            <CardDescription className="text-center">로딩 중...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  )
}

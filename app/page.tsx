import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Truck, Shield, Clock, Link2, FileText, Users, AlertTriangle, CheckCircle2, Building2 } from "lucide-react"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"

export default async function HomePage() {
  const supabase = await getSupabaseServerClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 로그인한 사용자는 역할에 따라 대시보드로 리다이렉트
  if (user) {
    // maybeSingle() 사용 - 결과가 없어도 에러를 던지지 않음
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    
    // 에러 로깅 (RLS 정책 위반 등)
    if (profileError) {
      console.error("Profile fetch error:", profileError)
      console.error("User ID:", user.id)
      console.error("Error details:", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      })
      
      // RLS 정책 위반인 경우 또는 기타 에러인 경우 프로필이 없다고 간주
      // 회원가입 페이지로 리다이렉트
      redirect("/auth/signup?error=profile_missing")
    }
    
    const roleOverride = await getRoleOverride()

    // 프로필이 있고 role이 있는 경우 역할에 따라 리다이렉트
    if (profile && profile.role) {
      const targetRole = roleOverride || profile.role
      if (targetRole === "admin") {
        redirect("/admin")
      } else if (targetRole === "driver") {
        redirect("/driver")
      } else {
        redirect("/customer")
      }
    } else {
      // 프로필이 없거나 role이 없는 경우 회원가입 페이지로 리다이렉트
      console.warn("Profile not found or missing role, redirecting to signup")
      console.warn("User ID:", user.id)
      redirect("/auth/signup?error=profile_missing")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50">
      <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold text-balance">
            빠르고 안전한
            <br />
            <span className="text-primary">퀵배송 연결 플랫폼</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            우리는 <strong className="text-primary">연결만 합니다</strong>. 기사와 고객을 연결하고, 모든 거래를 기록합니다.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button asChild size="lg" className="text-lg px-8">
              <Link href="/auth/signup">시작하기</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 bg-transparent">
              <Link href="/auth/login">로그인</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <Card>
            <CardHeader>
              <Package className="h-12 w-12 text-primary mb-2" />
              <CardTitle>간편한 배송 요청</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>지도에서 터치 한 번으로 픽업과 배송지를 설정하고 즉시 요청하세요</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Truck className="h-12 w-12 text-primary mb-2" />
              <CardTitle>실시간 위치 추적</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                배송원의 현재 위치를 실시간으로 확인하고 정확한 도착 시간을 알 수 있습니다
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-12 w-12 text-primary mb-2" />
              <CardTitle>안전한 거래</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>검증된 배송원과 보험 처리로 안심하고 이용할 수 있습니다</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="h-12 w-12 text-primary mb-2" />
              <CardTitle>빠른 배송</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>가까운 배송원이 즉시 매칭되어 신속하게 배송합니다</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* 비즈니스 모델 명확화 섹션 */}
        <div className="mt-24 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-4xl font-bold">명확한 플랫폼 정책</h2>
            <p className="text-muted-foreground">애매함 없는 비즈니스 모델</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 1. 중개 플랫폼 명확화 */}
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  1️⃣ 우리는 중개 플랫폼입니다
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">우리는 연결만 합니다</p>
                    <p className="text-sm text-muted-foreground">
                      운송 주체가 아닌 중개 플랫폼으로, 기사와 고객을 연결하는 역할만 수행합니다.
                    </p>
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm">
                    <strong>책임 범위:</strong> 연결 서비스 제공 및 거래 기록 관리
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 2. 수익 모델 */}
            <Card className="border-2 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  2️⃣ 수익 모델
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>현재:</strong> 무료 서비스 (수수료 없음)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>향후 계획:</strong> 거래 수수료 전환 예정
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm">
                    초기에는 수익을 내지 않지만, 향후 수수료 기반 수익 모델로 전환할 계획입니다.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 3. 영업 주체 */}
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  3️⃣ 영업의 주체
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <p className="text-sm">기사 추천</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <p className="text-sm">고객 추천</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-1 flex-shrink-0" />
                    <p className="text-sm line-through">텔레마케터</p>
                  </div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-sm font-semibold">플랫폼 철학</p>
                  <p className="text-sm text-muted-foreground">
                    "현장에 있는 사람이 가장 강한 영업자"
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 4. 사고 책임 */}
            <Card className="border-2 border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-600" />
                  4️⃣ 사고 시 책임 주체
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold">인적 사고 (상해·사망)</p>
                    <p className="text-sm text-muted-foreground">기사 개인 책임</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">물품 사고 (파손·분실)</p>
                    <p className="text-sm text-muted-foreground">기사 + 플랫폼 보험</p>
                  </div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <p className="text-sm">
                    플랫폼은 물품 사고에 한해 보험 처리로 개입하며, 인적 사고는 기사 개인 책임입니다.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 5. MVP 기능 */}
            <Card className="border-2 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  5️⃣ MVP 기능 (최소 기능)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <p className="text-sm">연결 (기사-고객 매칭)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <p className="text-sm">기록 (거래 이력 관리)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground line-through">배차, 채팅, 결제, 위치 추적 (향후 추가)</p>
                  </div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm font-semibold">핵심 가치</p>
                  <p className="text-sm text-muted-foreground">
                    "연결 + 기록"만으로도 충분한 가치를 제공합니다.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 6. 법인 전환 타이밍 */}
            <Card className="border-2 border-indigo-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  6️⃣ 법인 전환 계획
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold">테스트 단계</p>
                    <p className="text-sm text-muted-foreground">개인 사업자로 운영</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">정식 서비스</p>
                    <p className="text-sm text-muted-foreground">법인 전환 예정</p>
                  </div>
                </div>
                <div className="bg-indigo-50 p-3 rounded-lg">
                  <p className="text-sm">
                    타이밍을 명확히 합의하여 향후 분쟁을 방지합니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-24 text-center">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-3xl">지금 바로 시작하세요</CardTitle>
              <CardDescription className="text-lg">명확한 정책으로 운영되는 중개 플랫폼</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                회원가입 시 고객 또는 배송원을 선택할 수 있습니다
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button asChild size="lg">
                  <Link href="/auth/signup">회원가입하기</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/terms">약관 및 정책 보기</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

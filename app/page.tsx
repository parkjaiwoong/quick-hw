import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Truck, Shield, Clock, Link2, FileText, Users, CheckCircle2, Building2 } from "lucide-react"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"
import { MainTermsButton } from "@/components/common/terms-trigger-buttons"
import { AppDownloadButton } from "@/components/driver/app-download-button"
import { HeroSection } from "@/components/home/hero-section"

export default async function HomePage() {
  const supabase = await getSupabaseServerClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 로그인한 사용자는 역할에 따라 대시보드로 리다이렉트
  if (user) {
    const [{ data: profile, error: profileError }, roleOverride] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      getRoleOverride(),
    ])

    if (profileError) {
      redirect("/auth/signup?error=profile_missing")
    }

    if (profile?.role) {
      const targetRole = roleOverride || profile.role
      if (targetRole === "admin") {
        redirect("/admin")
      } else if (targetRole === "driver") {
        redirect("/driver")
      } else {
        redirect("/customer")
      }
    } else {
      redirect("/auth/signup?error=profile_missing")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 bg-card shadow-sm hover:shadow-md transition-shadow rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">간편한 배송 요청</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">
                지도에서 터치 한 번으로 픽업과 배송지를 설정하고 즉시 요청하세요
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 bg-card shadow-sm hover:shadow-md transition-shadow rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">배송 현황 추적</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">
                실시간 알림과 기사 위치 확인으로 배송 상태를 한눈에 파악하세요
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 bg-card shadow-sm hover:shadow-md transition-shadow rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">안전한 거래</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">
                검증된 배송원과 보험 처리로 안심하고 이용할 수 있습니다
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 bg-card shadow-sm hover:shadow-md transition-shadow rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">빠른 배송</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">
                가까운 배송원이 즉시 매칭되어 신속하게 배송합니다
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Policy - 간결한 정책 요약 */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">명확한 플랫폼 정책</h2>
          <p className="text-muted-foreground">애매함 없는 비즈니스 모델</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border border-border/60 bg-card shadow-sm rounded-3xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary shrink-0" />
                <CardTitle className="text-sm font-semibold">중개 플랫폼</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                기사와 고객을 연결하는 역할만 수행합니다. 연결 서비스 및 거래 기록 관리.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card shadow-sm rounded-3xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <CardTitle className="text-sm font-semibold">요금 안내</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                기본 4,000원 (2km 포함) · 추가 1,000원/km · 플랫폼 수수료 0% (현재)
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card shadow-sm rounded-3xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <CardTitle className="text-sm font-semibold">영업 주체</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                기사·고객 추천 중심. &quot;현장에 있는 사람이 가장 강한 영업자&quot;
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card shadow-sm rounded-3xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <CardTitle className="text-sm font-semibold">사고 책임</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                인적 사고: 기사 개인 책임 · 물품 사고: 기사 + 플랫폼 보험
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card shadow-sm rounded-3xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <CardTitle className="text-sm font-semibold">제공 기능</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                연결 · 기록 · 결제 · 사고처리. 채팅·실시간 지도는 추후 제공 예정.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card shadow-sm rounded-3xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <CardTitle className="text-sm font-semibold">법인 전환</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                테스트: 개인 사업자 · 정식 서비스: 법인 전환 예정
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-24 md:pb-32">
        <Card className="border-0 bg-card shadow-lg shadow-black/5 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pt-10 pb-4">
            <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight">지금 바로 시작하세요</CardTitle>
            <CardDescription className="text-base">
              회원가입 시 고객 또는 배송원을 선택할 수 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-10">
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center flex-wrap">
              <Button asChild size="lg" className="h-12 px-8 rounded-full font-medium shadow-md">
                <Link href="/auth/signup">회원가입하기</Link>
              </Button>
              <MainTermsButton />
              <AppDownloadButton />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

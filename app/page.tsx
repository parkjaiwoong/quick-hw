import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Package, Truck, Shield, Clock, Link2, FileText, Users, CheckCircle2, Building2 } from "lucide-react"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"
import { MainTermsButton } from "@/components/common/terms-trigger-buttons"
import { AppDownloadButton } from "@/components/driver/app-download-button"
import { HeroSection } from "@/components/home/hero-section"

/** 메인 랜딩 카드 — 흰 배경 + 하단 은은한 그림자 */
const homeCard =
  "rounded-[20px] border-0 bg-white shadow-[0_6px_28px_-8px_rgba(15,23,42,0.08)] transition-[box-shadow,transform] duration-200 hover:shadow-[0_10px_32px_-8px_rgba(15,23,42,0.1)]"

const iconWrap = "mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#E8F1FF] text-[#3182F6]"

export default async function HomePage() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    <div className="min-h-screen bg-[#F8F9FA] text-[#191F28]">
      <HeroSection />

      {/* 서비스 소개 */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:pb-24 md:pt-6">
        <div className="mb-10 text-center md:mb-12">
          <h2 className="text-xl font-bold tracking-tight text-[#191F28] md:text-2xl">왜 퀵HW언넌인가요</h2>
          <p className="mt-1.5 text-sm text-[#8B95A1]">필요한 것만, 담백하게 담았습니다</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          <Card className={homeCard}>
            <CardHeader className="pb-1 pt-6">
              <div className={iconWrap}>
                <Package className="size-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-[17px] font-bold leading-snug text-[#191F28]">간편한 배송 요청</h3>
            </CardHeader>
            <CardContent className="pb-6 pt-0">
              <p className="text-[13px] leading-relaxed text-[#8B95A1]">
                지도에서 터치 한 번으로 픽업과 배송지를 설정하고 즉시 요청하세요
              </p>
            </CardContent>
          </Card>

          <Card className={homeCard}>
            <CardHeader className="pb-1 pt-6">
              <div className={iconWrap}>
                <Truck className="size-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-[17px] font-bold leading-snug text-[#191F28]">배송 현황 추적</h3>
            </CardHeader>
            <CardContent className="pb-6 pt-0">
              <p className="text-[13px] leading-relaxed text-[#8B95A1]">
                실시간 알림과 기사 위치 확인으로 배송 상태를 한눈에 파악하세요
              </p>
            </CardContent>
          </Card>

          <Card className={homeCard}>
            <CardHeader className="pb-1 pt-6">
              <div className={iconWrap}>
                <Shield className="size-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-[17px] font-bold leading-snug text-[#191F28]">안전한 거래</h3>
            </CardHeader>
            <CardContent className="pb-6 pt-0">
              <p className="text-[13px] leading-relaxed text-[#8B95A1]">
                검증된 배송원과 보험 처리로 안심하고 이용할 수 있습니다
              </p>
            </CardContent>
          </Card>

          <Card className={homeCard}>
            <CardHeader className="pb-1 pt-6">
              <div className={iconWrap}>
                <Clock className="size-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-[17px] font-bold leading-snug text-[#191F28]">빠른 배송</h3>
            </CardHeader>
            <CardContent className="pb-6 pt-0">
              <p className="text-[13px] leading-relaxed text-[#8B95A1]">
                가까운 배송원이 즉시 매칭되어 신속하게 배송합니다
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 정책 요약 */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="mb-10 text-center md:mb-12">
          <h2 className="text-xl font-bold tracking-tight text-[#191F28] md:text-2xl">명확한 플랫폼 정책</h2>
          <p className="mt-1.5 text-sm text-[#8B95A1]">애매함 없는 비즈니스 모델</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Link2,
              title: "중개 플랫폼",
              body: "기사와 고객을 연결하는 역할만 수행합니다. 연결 서비스 및 거래 기록 관리.",
            },
            {
              icon: FileText,
              title: "요금 안내",
              body: "기본 4,000원 (2km 포함) · 추가 1,000원/km · 플랫폼 수수료 0% (현재)",
            },
            {
              icon: Users,
              title: "영업 주체",
              body: "기사·고객 추천 중심. \"현장에 있는 사람이 가장 강한 영업자\"",
            },
            {
              icon: Shield,
              title: "사고 책임",
              body: "인적 사고: 기사 개인 책임 · 물품 사고: 기사 + 플랫폼 보험",
            },
            {
              icon: CheckCircle2,
              title: "제공 기능",
              body: "연결 · 기록 · 결제 · 사고처리. 채팅·실시간 지도는 추후 제공 예정.",
            },
            {
              icon: Building2,
              title: "법인 전환",
              body: "테스트: 개인 사업자 · 정식 서비스: 법인 전환 예정",
            },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className={homeCard}>
              <CardHeader className="space-y-2 pb-2 pt-5">
                <div className="flex items-center gap-2.5">
                  <Icon className="size-[18px] shrink-0 text-[#3182F6]" strokeWidth={1.75} />
                  <h3 className="text-[15px] font-bold text-[#191F28]">{title}</h3>
                </div>
              </CardHeader>
              <CardContent className="pb-5 pt-0">
                <p className="text-[13px] leading-relaxed text-[#8B95A1]">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-lg px-4 pb-20 md:max-w-xl md:pb-28">
        <Card className={`${homeCard} overflow-hidden`}>
          <CardHeader className="space-y-2 pb-2 pt-9 text-center">
            <h2 className="text-[22px] font-bold tracking-tight text-[#191F28] md:text-2xl">지금 바로 시작하세요</h2>
            <p className="text-sm text-[#8B95A1]">회원가입 시 고객 또는 배송원을 선택할 수 있습니다</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-3 pb-9 pt-2 sm:flex-row sm:flex-wrap">
            <Button
              asChild
              size="lg"
              className="h-12 w-full min-w-[200px] rounded-full border-0 bg-[#3182F6] text-[15px] font-bold text-white shadow-[0_6px_20px_rgba(49,130,246,0.35)] hover:bg-[#2563EB] sm:w-auto"
            >
              <Link href="/auth/signup">회원가입하기</Link>
            </Button>
            <MainTermsButton />
            <AppDownloadButton />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

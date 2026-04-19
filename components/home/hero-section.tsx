"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-slate-900">
      {/* 그라데이션 배경 (외부 비디오 제거 - WebView ORB 오류 방지) */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/5" />
      </div>

      {/* 속도감 라인 디자인 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-20 top-1/4 w-96 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-speed-line" />
        <div className="absolute -right-20 top-1/3 w-80 h-px bg-gradient-to-l from-transparent via-primary/20 to-transparent animate-speed-line-delayed" />
        <div className="absolute left-1/4 -bottom-10 w-64 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent animate-speed-line-slow" />
      </div>

      {/* 콘텐츠 */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 mb-8">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium tracking-widest text-primary uppercase">퀵배송 연결 플랫폼</span>
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6">
          <span className="relative inline-block">
            <span className="relative z-10 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent drop-shadow-lg">
              퀵
            </span>
            <span className="absolute inset-0 blur-xl bg-primary/40 rounded-full scale-150 opacity-60" />
            <span className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg animate-shimmer" />
          </span>
          <span className="text-white">HW언넌</span>
        </h1>

        <p className="text-xl md:text-2xl text-slate-300 font-light max-w-xl mx-auto mb-4">
          빠르고 안전한 배송, 한 번에 연결
        </p>
        <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto mb-12">
          기사와 고객을 연결하고 모든 거래를 기록합니다
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            asChild
            size="lg"
            className="h-14 px-10 rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/30 transition-all hover:scale-105"
          >
            <Link href="/auth/signup">시작하기</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-14 px-10 rounded-full text-base font-semibold border-white/30 bg-white/5 text-white hover:bg-white/15 backdrop-blur"
          >
            <Link href="/auth/login">로그인</Link>
          </Button>
        </div>
      </div>

      {/* 하단 그라데이션 페이드 */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  )
}

"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

/** 메인 랜딩 — 라이트 배경, 상단 대형 검색, 비비드 블루/옐로 포인트 (토스·배민형) */
export function HeroSection() {
  return (
    <section className="relative bg-[#F8F9FA] px-4 pb-10 pt-8 md:pb-14 md:pt-10">
      <div className="mx-auto flex max-w-lg flex-col items-stretch md:max-w-2xl">
        {/* 상단 배지 — 카카오 옐로 힌트 */}
        <div className="mb-5 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FEE500] px-3.5 py-1.5 text-xs font-bold text-[#191919] shadow-sm">
            퀵배송 연결
          </span>
        </div>

        {/* 타이포 위계 */}
        <h1 className="mb-1 text-center text-[28px] font-bold leading-tight tracking-tight text-[#191F28] md:text-[34px]">
          퀵HW언넌
        </h1>
        <p className="mb-2 text-center text-[15px] font-semibold text-[#191F28] md:text-base">
          빠르고 안전한 배송
        </p>
        <p className="mb-8 text-center text-[13px] leading-relaxed text-[#8B95A1] md:text-sm">
          기사와 고객을 연결하고, 거래를 한곳에서 관리합니다
        </p>

        {/* 큰 검색창 — 라운드 20px, 흰 배경 */}
        <Link
          href="/auth/signup"
          className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3182F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F9FA] rounded-[20px]"
          aria-label="배송 시작하기 — 회원가입"
        >
          <div
            className="flex min-h-[58px] w-full cursor-pointer items-center gap-3 rounded-[20px] border border-[#E5E8EB] bg-white px-4 py-3.5 shadow-[0_6px_24px_-6px_rgba(15,23,42,0.08)] transition-[box-shadow,border-color,transform] duration-200 ease-out group-hover:border-[#D1D6DB] group-hover:shadow-[0_8px_28px_-6px_rgba(37,99,235,0.12)] md:min-h-[64px] md:px-5 md:py-4"
          >
            <Search
              className="size-[22px] shrink-0 text-[#8B95A1] transition-colors group-hover:text-[#3182F6]"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-left text-[15px] text-[#8B95A1] md:text-base">
              어디로 배송할까요?
            </span>
            <span className="shrink-0 rounded-full bg-[#3182F6] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-[1.02] md:px-5 md:text-sm">
              시작
            </span>
          </div>
        </Link>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            asChild
            variant="outline"
            className="h-11 w-full rounded-full border-[#E5E8EB] bg-white text-[14px] font-semibold text-[#191F28] shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:bg-[#F8F9FA] sm:w-auto sm:min-w-[120px]"
          >
            <Link href="/auth/login">로그인</Link>
          </Button>
          <Button
            asChild
            className="h-11 w-full rounded-full border-0 bg-[#3182F6] text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(49,130,246,0.35)] hover:bg-[#2563EB] sm:w-auto sm:min-w-[120px]"
          >
            <Link href="/auth/signup">회원가입</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

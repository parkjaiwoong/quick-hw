import Link from "next/link"
import { Package, Truck, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TermsButton } from "@/components/common/terms-modal"

/** 데이터 대기 없이 바로 그려 첫 페인트·체감 속도 개선 */
export function CustomerDashboardShell() {
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary to-primary/90 p-6 md:p-8 text-primary-foreground shadow-lg">
        <div className="relative z-10">
          <p className="text-sm font-medium opacity-90 mb-1">퀵HW 배송</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">가까운 기사와 빠르게 연결</h1>
          <p className="text-sm opacity-90 mb-6 max-w-md">
            출발지·도착지만 입력하면 즉시 매칭 · 물품 파손·분실 시 보험 처리
          </p>
          <Button
            asChild
            size="lg"
            className="bg-white text-primary hover:bg-white/95 font-semibold shadow-md h-12 px-6 rounded-xl"
          >
            <Link href="/customer/new-delivery" prefetch>
              <Package className="mr-2 h-5 w-5" />
              배송 요청하기
            </Link>
          </Button>
        </div>
        <div className="absolute -right-4 -bottom-4 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:block">
          <Truck className="h-24 w-24 text-white/20" />
        </div>
      </div>

      <Alert className="rounded-xl border-orange-200 bg-orange-50/80">
        <AlertCircle className="h-4 w-4 text-orange-600 shrink-0" />
        <AlertDescription className="text-orange-800 text-sm">
          <strong>중개 플랫폼 안내</strong> — 요금은 플랫폼 요금 기준 자동 산정 ·{" "}
          <TermsButton
            type="service"
            label="약관 보기"
            className="inline h-auto p-0 text-xs text-orange-800 underline underline-offset-2"
          />
        </AlertDescription>
      </Alert>
    </>
  )
}

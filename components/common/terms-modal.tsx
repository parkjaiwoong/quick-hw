"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, Shield, Lock } from "lucide-react"

// ────────────────────────────────────────────────
// 약관 타입
// ────────────────────────────────────────────────
export type TermsType = "service" | "privacy" | "insurance"

const TERMS_CONFIG: Record<TermsType, { title: string; icon: React.ReactNode }> = {
  service:   { title: "서비스 이용약관",   icon: <FileText className="h-4 w-4" /> },
  privacy:   { title: "개인정보 처리방침", icon: <Lock className="h-4 w-4" /> },
  insurance: { title: "보험 안내 약관",    icon: <Shield className="h-4 w-4" /> },
}

// ────────────────────────────────────────────────
// 약관 본문 컴포넌트
// ────────────────────────────────────────────────
function PrivacyContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      <div>
        <p className="font-semibold text-foreground mb-1">제1조 (개인정보의 처리 목적)</p>
        <p>퀵HW언넌(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않습니다.</p>
        <ul className="list-disc list-inside mt-1 space-y-0.5 pl-2">
          <li>회원 가입 및 관리: 회원 식별, 서비스 이용 계약 이행</li>
          <li>배송 서비스 제공: 기사-고객 매칭, 배송 현황 안내</li>
          <li>결제 처리: 요금 결제 및 정산</li>
          <li>고객 문의 및 사고 접수 처리</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제2조 (처리하는 개인정보 항목)</p>
        <p className="mb-1"><strong>고객 회원:</strong> 이름, 이메일, 비밀번호(암호화), 휴대폰 번호, 서비스 이용 기록</p>
        <p><strong>배송원 회원:</strong> 이름, 이메일, 비밀번호(암호화), 휴대폰 번호, 차량 정보, 면허 번호, 위치 정보(배송 중)</p>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제3조 (개인정보 보유 기간)</p>
        <ul className="list-disc list-inside space-y-0.5 pl-2">
          <li>회원 정보: 회원 탈퇴 시까지</li>
          <li>거래·결제 기록: 5년 (전자상거래법)</li>
          <li>접속 로그: 3개월 (통신비밀보호법)</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제4조 (제3자 제공)</p>
        <ul className="list-disc list-inside space-y-0.5 pl-2">
          <li>결제 처리: 토스페이먼츠 (결제 정보)</li>
          <li>SMS 인증: 솔라피 (휴대폰 번호)</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제5조 (정보주체의 권리)</p>
        <p>개인정보 열람·정정·삭제·처리정지 요구는 고객 대시보드 내 문의하기를 통해 행사할 수 있습니다.</p>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제6조 (안전성 확보 조치)</p>
        <ul className="list-disc list-inside space-y-0.5 pl-2">
          <li>비밀번호 단방향 암호화(bcrypt) 저장</li>
          <li>통신 구간 HTTPS/TLS 암호화</li>
          <li>역할 기반 접근 제어(RLS) 적용</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제7조 (개인정보 보호책임자)</p>
        <div className="bg-muted/50 p-3 rounded-lg">
          <p><strong>개인정보 보호책임자</strong></p>
          <p>소속: 퀵HW언넌 운영팀</p>
          <p>문의: 고객 대시보드 내 1:1 문의</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">시행일: 2025년 1월 1일</p>
    </div>
  )
}

function ServiceContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      <div>
        <p className="font-semibold text-foreground mb-1">제1조 (목적)</p>
        <p>본 약관은 퀵HW언넌(이하 "회사")가 제공하는 퀵배송 중개 서비스의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제2조 (서비스의 성격)</p>
        <p>회사는 <strong>운송 당사자가 아닌 중개 플랫폼</strong>입니다. 기사와 고객을 연결하고 거래를 기록하는 역할만 수행하며, 실제 운송 계약은 기사와 고객 간에 체결됩니다.</p>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제3조 (요금)</p>
        <ul className="list-disc list-inside space-y-0.5 pl-2">
          <li>기본 요금: 4,000원 (기본 2km 포함)</li>
          <li>추가 거리: 1,000원/km</li>
          <li>플랫폼 수수료: 현재 0% (향후 변경 시 사전 공지)</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제4조 (책임 한계)</p>
        <ul className="list-disc list-inside space-y-0.5 pl-2">
          <li>인적 사고(상해·사망): 기사 개인 책임</li>
          <li>물품 사고(파손·분실): 기사 + 플랫폼 보험 처리</li>
          <li>플랫폼은 연결 서비스 제공 범위 내에서만 책임을 집니다</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제5조 (이용자 의무)</p>
        <ul className="list-disc list-inside space-y-0.5 pl-2">
          <li>타인의 정보를 도용하거나 허위 정보를 제공하지 않을 것</li>
          <li>서비스를 불법적인 목적으로 이용하지 않을 것</li>
          <li>다른 이용자의 서비스 이용을 방해하지 않을 것</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">제6조 (서비스 변경 및 중단)</p>
        <p>회사는 서비스 내용을 변경하거나 중단할 수 있으며, 중요한 변경 사항은 사전에 공지합니다.</p>
      </div>
    </div>
  )
}

function InsuranceContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      <div>
        <p className="font-semibold text-foreground mb-1">플랫폼 단체 물품 보험 안내</p>
        <p>퀵HW언넌 플랫폼을 통해 진행되는 배송 건에 한해 물품 사고 시 보험이 적용됩니다.</p>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">보상 범위</p>
        <ul className="list-disc list-inside space-y-0.5 pl-2">
          <li>물품 파손: 실제 손해액 (최대 100만원)</li>
          <li>물품 분실: 실제 손해액 (최대 100만원)</li>
          <li>인적 사고(상해·사망): 보상 불가 — 기사 개인 책임</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">보상 제외 사항</p>
        <ul className="list-disc list-inside space-y-0.5 pl-2">
          <li>고의 또는 중대한 과실로 인한 사고</li>
          <li>현금, 유가증권, 귀금속류</li>
          <li>부패·변질되기 쉬운 물품</li>
          <li>플랫폼 외부에서 직접 계약된 배송</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">사고 접수 방법</p>
        <p>배송 완료 후 7일 이내에 고객 대시보드 → 사고 접수를 통해 신청하시기 바랍니다. 접수 후 1영업일 내 안내드립니다.</p>
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <p className="text-orange-800 text-xs">본 보험은 플랫폼 단체 계약 보험으로, 세부 보상 조건은 실제 보험 약관에 따릅니다. 보험 가입 여부 및 세부 내용은 운영팀에 문의하세요.</p>
      </div>
    </div>
  )
}

const TERMS_CONTENT: Record<TermsType, React.ReactNode> = {
  privacy:   <PrivacyContent />,
  service:   <ServiceContent />,
  insurance: <InsuranceContent />,
}

// ────────────────────────────────────────────────
// 모달 컴포넌트 (제어형 — 외부에서 open/onClose 전달)
// ────────────────────────────────────────────────
interface TermsModalProps {
  type: TermsType
  open: boolean
  onClose: () => void
}

export function TermsModal({ type, open, onClose }: TermsModalProps) {
  const cfg = TERMS_CONFIG[type]
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cfg.icon}
            {cfg.title}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">{TERMS_CONTENT[type]}</div>
        <div className="pt-2 flex justify-end border-t mt-2">
          <Button onClick={onClose}>확인</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────────
// 트리거 버튼 (자체 상태 관리 — 독립 사용 가능)
// ────────────────────────────────────────────────
interface TermsButtonProps {
  type: TermsType
  /** 버튼 레이블 (기본: 약관 보기) */
  label?: string
  className?: string
  variant?: "link" | "outline" | "ghost" | "default"
}

export function TermsButton({ type, label, className, variant = "link" }: TermsButtonProps) {
  const [open, setOpen] = useState(false)
  const cfg = TERMS_CONFIG[type]

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className ?? "h-auto p-0 text-xs underline underline-offset-2"}
        onClick={() => setOpen(true)}
      >
        {label ?? cfg.title}
      </Button>
      <TermsModal type={type} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

// ────────────────────────────────────────────────
// 약관 전체 보기 버튼 (서비스 + 개인정보 + 보험 순차 표시)
// ────────────────────────────────────────────────
interface AllTermsButtonProps {
  label?: string
  className?: string
  variant?: "link" | "outline" | "ghost" | "default"
}

export function AllTermsButton({ label = "약관 보기", className, variant = "link" }: AllTermsButtonProps) {
  const [current, setCurrent] = useState<TermsType | null>(null)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className ?? "h-auto p-0 text-xs underline underline-offset-2"}
        onClick={() => setCurrent("service")}
      >
        {label}
      </Button>
      {current && (
        <TermsModal type={current} open={true} onClose={() => setCurrent(null)} />
      )}
    </>
  )
}

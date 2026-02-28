"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { completeDriverGuide } from "@/lib/actions/driver-guide"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  MapPin,
  Package,
  CreditCard,
  AlertTriangle,
  Phone,
  Star,
} from "lucide-react"

const STEPS = [
  {
    id: 1,
    icon: Smartphone,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50",
    title: "앱 사용 시작하기",
    content: [
      {
        heading: "배송 가능 상태 설정",
        body: "메인 화면 상단의 토글 버튼으로 '배송 가능' 상태를 켜야 배송 요청을 받을 수 있습니다. 업무를 마치면 반드시 '배송 불가'로 변경해주세요.",
      },
      {
        heading: "알림 허용 필수",
        body: "새 배송 요청이 오면 푸시 알림으로 알려드립니다. 기기 설정에서 퀵HW언넌 앱 알림을 반드시 허용해주세요.",
      },
      {
        heading: "위치 권한 허용",
        body: "정확한 배송 매칭을 위해 위치 권한을 '항상 허용'으로 설정해주세요.",
      },
    ],
  },
  {
    id: 2,
    icon: Package,
    iconColor: "text-green-600",
    bgColor: "bg-green-50",
    title: "배송 수락 및 픽업",
    content: [
      {
        heading: "배송 요청 수락",
        body: "배송 요청 알림이 오면 '대기중인 배송' 화면에서 내용을 확인 후 수락하세요. 수락 후에는 반드시 픽업 장소로 이동해야 합니다.",
      },
      {
        heading: "픽업 확인",
        body: "물품을 수령한 후 앱에서 '픽업 완료' 버튼을 눌러주세요. 픽업 전 물품 상태(파손 여부)를 반드시 확인하세요.",
      },
      {
        heading: "배송 완료 처리",
        body: "고객에게 물품을 전달한 후 '배송 완료' 버튼을 눌러주세요. 완료 처리 후 정산이 시작됩니다.",
      },
    ],
  },
  {
    id: 3,
    icon: MapPin,
    iconColor: "text-orange-600",
    bgColor: "bg-orange-50",
    title: "고객 응대 매너",
    content: [
      {
        heading: "연락 방법",
        body: "배송 중 고객 연락이 필요한 경우 앱 내 전화 기능을 사용하세요. 개인 번호 노출을 최소화할 수 있습니다.",
      },
      {
        heading: "지연 시 사전 안내",
        body: "교통 체증 등으로 지연이 예상되면 고객에게 미리 연락해주세요. 사전 안내가 없는 지연은 불만으로 이어질 수 있습니다.",
      },
      {
        heading: "정중한 응대",
        body: "고객과의 모든 소통은 정중하게 해주세요. 분쟁 발생 시 앱 내 신고 기능을 이용하세요.",
      },
    ],
  },
  {
    id: 4,
    icon: CreditCard,
    iconColor: "text-purple-600",
    bgColor: "bg-purple-50",
    title: "정산 및 출금",
    content: [
      {
        heading: "정산 주기",
        body: "배송 완료 후 정산이 생성됩니다. 관리자 확정 후 출금 요청이 가능합니다.",
      },
      {
        heading: "출금 요청",
        body: "'정산 관리' 메뉴에서 출금 가능 금액을 확인하고 출금 요청을 할 수 있습니다. 등록된 계좌로 입금됩니다.",
      },
      {
        heading: "계좌 등록",
        body: "출금을 위해 정산 관리 화면에서 은행 계좌를 미리 등록해두세요.",
      },
    ],
  },
  {
    id: 5,
    icon: AlertTriangle,
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
    title: "사고 및 분쟁 처리",
    content: [
      {
        heading: "물품 파손/분실 시",
        body: "배송 중 물품이 파손되거나 분실된 경우 즉시 앱 내 '사고 신고' 기능을 이용하세요. 사진 증거를 반드시 남겨두세요.",
      },
      {
        heading: "플랫폼 보험",
        body: "가입 시 동의한 플랫폼 단체 물품 보험이 적용됩니다. 보상 한도 및 절차는 약관을 참고하세요.",
      },
      {
        heading: "고객 분쟁",
        body: "고객과 분쟁이 발생하면 임의로 해결하지 말고 반드시 고객센터(앱 내 문의)를 통해 처리해주세요.",
      },
    ],
  },
  {
    id: 6,
    icon: Phone,
    iconColor: "text-teal-600",
    bgColor: "bg-teal-50",
    title: "고객센터 및 주의사항",
    content: [
      {
        heading: "고객센터 이용",
        body: "앱 사용 중 문제가 생기면 앱 내 '문의하기' 기능을 이용해주세요. 운영시간 외에는 문자로 남겨주시면 순차적으로 답변드립니다.",
      },
      {
        heading: "금지 행위",
        body: "배송 중 음주운전, 무면허 운전, 타인에게 배송 대리 위탁은 엄격히 금지됩니다. 적발 시 즉시 계정이 정지됩니다.",
      },
      {
        heading: "개인정보 보호",
        body: "배송 과정에서 알게 된 고객 정보(주소, 연락처 등)는 배송 목적 외에 절대 사용하지 마세요.",
      },
    ],
  },
]

export default function DriverGuidePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const step = STEPS[currentStep]
  const isLast = currentStep === STEPS.length - 1
  const Icon = step.icon

  function handleNext() {
    if (isLast) {
      startTransition(async () => {
        await completeDriverGuide()
        setCompleted(true)
      })
    } else {
      setCurrentStep((v) => v + 1)
    }
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-blue-50 p-4">
        <div className="text-center space-y-6 max-w-sm">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-6">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">교육 완료!</h1>
            <p className="mt-2 text-gray-600">
              퀵HW언넌 기사 온보딩 가이드를 모두 읽으셨습니다.
              <br />이제 배송을 시작할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center justify-center gap-1 text-yellow-500">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-5 w-5 fill-yellow-400" />
            ))}
          </div>
          <Button className="w-full" size="lg" onClick={() => router.push("/driver")}>
            배송 시작하기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-lg font-bold text-gray-900">기사 온보딩 가이드</h1>
          <Badge variant="outline" className="text-xs">
            {currentStep + 1} / {STEPS.length}
          </Badge>
        </div>

        {/* 진행 바 */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* 스텝 카드 */}
        <Card className="shadow-sm">
          <CardContent className="pt-6 space-y-5">
            {/* 아이콘 + 제목 */}
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-3 ${step.bgColor}`}>
                <Icon className={`h-7 w-7 ${step.iconColor}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">STEP {step.id}</p>
                <h2 className="text-lg font-bold">{step.title}</h2>
              </div>
            </div>

            {/* 내용 */}
            <div className="space-y-4">
              {step.content.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className={`w-5 h-5 rounded-full ${step.bgColor} flex items-center justify-center`}>
                      <span className={`text-xs font-bold ${step.iconColor}`}>{i + 1}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.heading}</p>
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 스텝 인디케이터 */}
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep ? "w-6 bg-blue-600" : i < currentStep ? "w-3 bg-blue-300" : "w-3 bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* 네비게이션 버튼 */}
        <div className="flex gap-3 pb-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setCurrentStep((v) => v - 1)}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            이전
          </Button>
          <Button
            className="flex-1"
            onClick={handleNext}
            disabled={isPending}
          >
            {isPending ? "저장 중..." : isLast ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                교육 완료
              </>
            ) : (
              <>
                다음
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

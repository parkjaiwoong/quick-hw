import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Shield } from "lucide-react"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/terms">
              <ChevronLeft className="h-4 w-4 mr-1" />
              약관 목록
            </Link>
          </Button>
        </div>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">개인정보 처리방침</h1>
          </div>
          <p className="text-muted-foreground text-sm">시행일: 2025년 1월 1일</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">제1조 (개인정보의 처리 목적)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>퀵HW언넌(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>회원 가입 및 관리: 회원 식별, 서비스 이용 계약 이행</li>
              <li>배송 서비스 제공: 기사-고객 매칭, 배송 현황 안내</li>
              <li>결제 처리: 요금 결제 및 정산</li>
              <li>고객 문의 및 사고 접수 처리</li>
              <li>서비스 개선 및 통계 분석</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">제2조 (처리하는 개인정보의 항목)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <div>
              <p className="font-medium text-foreground mb-1">고객 회원</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>필수: 이름, 이메일 주소, 비밀번호(암호화 저장), 휴대폰 번호</li>
                <li>선택: 배송지 주소</li>
                <li>자동 수집: 서비스 이용 기록, 접속 로그, 결제 기록</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">배송원(기사) 회원</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>필수: 이름, 이메일 주소, 비밀번호(암호화 저장), 휴대폰 번호</li>
                <li>필수: 차량 종류, 차량 번호, 운전면허 번호</li>
                <li>선택: 면허증 사진, 차량 사진</li>
                <li>자동 수집: 위치 정보(배송 중), 배송 이력, 정산 기록</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">제3조 (개인정보의 처리 및 보유 기간)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>회원 정보: 회원 탈퇴 시까지</li>
              <li>거래 기록: 5년 (전자상거래법)</li>
              <li>결제 기록: 5년 (전자상거래법)</li>
              <li>접속 로그: 3개월 (통신비밀보호법)</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">제4조 (개인정보의 제3자 제공)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</p>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="font-medium text-foreground mb-1">서비스 제공을 위한 필수 제공</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>결제 처리: 토스페이먼츠(결제 정보)</li>
                <li>SMS 인증: 솔라피(휴대폰 번호)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">제5조 (정보주체의 권리·의무 및 행사 방법)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리 정지 요구</li>
            </ul>
            <p className="mt-2">권리 행사는 고객 대시보드 내 문의하기 또는 이메일을 통해 하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">제6조 (개인정보의 안전성 확보 조치)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>비밀번호 암호화: 단방향 암호화(bcrypt) 저장</li>
              <li>통신 구간 암호화: HTTPS/TLS 적용</li>
              <li>접근 권한 관리: 역할 기반 접근 제어(RLS)</li>
              <li>개인정보 취급자 최소화 및 교육</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">제7조 (개인정보 보호책임자)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 정보주체의 개인정보 관련 불만 처리 및 피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p><strong>개인정보 보호책임자</strong></p>
              <p>소속: 퀵HW언넌 운영팀</p>
              <p>문의: 고객 대시보드 내 1:1 문의</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center pb-6">
          <Button asChild>
            <Link href="/auth/signup">회원가입으로 돌아가기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

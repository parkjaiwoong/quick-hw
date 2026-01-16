import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Shield, FileText } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">약관 및 안내</h1>
          <p className="text-muted-foreground">서비스 이용 약관 및 중요 안내사항</p>
        </div>

        {/* 법적 고지 */}
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>중요:</strong> 본 플랫폼은 운송 당사자가 아닌 <strong>중개 플랫폼</strong>입니다. 
            우리는 <strong>연결만 합니다</strong>. 기사와 고객을 연결하고 거래를 기록하는 역할만 수행합니다.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              서비스 정체성
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/5 p-4 rounded-lg mb-4">
              <p className="font-semibold text-lg mb-2">우리는 연결만 합니다</p>
              <p>
                본 플랫폼은 퀵 기사와 고객(또는 업체)을 연결해주는 <strong>중개 플랫폼</strong>입니다.
                운송 주체가 아닌 연결 서비스 제공자입니다.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="font-semibold mb-1">요금 산정</p>
                <p className="text-sm text-muted-foreground">
                  요금은 카카오픽 기준으로 자동 산정됩니다.
                  <br />
                  <strong>기준:</strong> 기본요금 4,000원 + 2km 초과분 km당 1,000원
                  <br />
                  <strong>현재:</strong> 수수료 없음 (무료 서비스)
                  <br />
                  <strong>향후:</strong> 거래 수수료 전환 예정
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">인적 사고 책임</p>
                <p className="text-sm text-muted-foreground">
                  인적 사고(상해·사망)는 <strong>기사 개인 책임</strong>입니다.
                  플랫폼은 인적 사고에 대해 책임을 지지 않습니다.
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">물품 사고 책임</p>
                <p className="text-sm text-muted-foreground">
                  물품 사고(파손·분실)는 <strong>기사 + 플랫폼 보험</strong>으로 처리되며, 
                  명확한 한도 내에서만 보상됩니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              보험 안내
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">플랫폼 단체 물품 보험</h3>
              <p className="text-sm text-muted-foreground mb-4">
                물품 파손·분실 시 플랫폼 보험으로 처리됩니다.
              </p>
              <div className="space-y-2">
                <p><strong>보상 범위:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>물품 파손: 실제 손해액 (최대 100만원)</li>
                  <li>물품 분실: 실제 손해액 (최대 100만원)</li>
                  <li>인적 사고: 보상 불가 (기사 개인 책임)</li>
                </ul>
              </div>
            </div>
            <Alert>
              <AlertDescription>
                보상 한도 및 세부 사항은 보험 약관에 명시되어 있습니다. 
                사고 발생 시 즉시 접수해주시기 바랍니다.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>요금 및 수익 모델</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold mb-2">요금 산정 방식</p>
              <p className="mb-4">
                요금은 카카오픽 기준으로 자동 산정됩니다.
              </p>
              <p className="text-sm text-muted-foreground">
                기본요금 4,000원 + 2km 초과분 km당 1,000원으로 계산됩니다.
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="font-semibold mb-2">수익 모델</p>
              <p className="text-sm mb-2">
                <strong>현재:</strong> 무료 서비스 (수수료 없음)
              </p>
              <p className="text-sm">
                <strong>향후 계획:</strong> 거래 수수료 기반 수익 모델로 전환 예정
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>책임 한계</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">플랫폼 책임</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>물품 사고 보상 (약관에 명시된 범위 내)</li>
                <li>기사-고객 연결 서비스 제공</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">플랫폼 비책임</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>인적 사고 (상해·사망) - 기사 개인 책임</li>
                <li>요금 결제 및 환불 - 정책에 따른 처리</li>
                <li>운송 계약 위반 - 기사-고객 간 분쟁</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>문의 및 사고 접수</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              일반 문의나 물품 사고 접수가 필요하신 경우, 고객 대시보드에서 접수하실 수 있습니다.
            </p>
            <p className="text-sm text-muted-foreground">
              사고 접수 후 1영업일 내 안내드립니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">이메일 확인</CardTitle>
          <CardDescription className="text-center">
            가입하신 이메일로 인증 링크를 발송했습니다.
            <br />
            이메일을 확인하고 링크를 클릭하여 계정을 활성화하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          이메일을 받지 못하셨나요? 스팸 메일함을 확인해주세요.
        </CardContent>
      </Card>
    </div>
  )
}

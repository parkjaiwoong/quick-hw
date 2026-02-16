import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"
import Link from "next/link"
import { Smartphone, ArrowLeft, ExternalLink } from "lucide-react"

export default async function DriverAppDownloadPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) {
    redirect("/")
  }

  const androidStoreUrl = process.env.NEXT_PUBLIC_DRIVER_APP_ANDROID_URL ?? ""
  // 기본: 같은 웹 서버의 /downloads/driver-app.apk (public 폴더에 넣으면 됨). 다른 URL 쓰려면 env로 덮어쓰기
  const apkUrl = process.env.NEXT_PUBLIC_DRIVER_APP_APK_URL ?? "/downloads/driver-app.apk"
  const iosUrl = process.env.NEXT_PUBLIC_DRIVER_APP_IOS_URL ?? ""
  const hasIos = Boolean(iosUrl)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/driver" aria-label="대시보드로 돌아가기">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="h-7 w-7 text-blue-600" />
              기사 전용 앱 다운로드
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              배송원 앱을 설치하면 모바일에서 편하게 접수·배송할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {/* Android */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Android</CardTitle>
              <CardDescription>
                APK로 설치 (나중에 Play Store 등록 시 스토어 링크 추가 가능)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
              <Button asChild>
                <a href={apkUrl} download className="inline-flex items-center gap-2">
                  APK 다운로드
                </a>
              </Button>
              {androidStoreUrl ? (
                <Button asChild variant="outline" className="bg-[#3ddc84] hover:bg-[#2fc76a] text-black border-0">
                  <a href={androidStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Play Store에서 받기
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {/* iOS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">iOS (iPhone / iPad)</CardTitle>
              <CardDescription>
                App Store에 등록 후 앱 페이지 URL을 설정하면 링크가 표시됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasIos ? (
                <Button asChild className="bg-black hover:bg-neutral-800">
                  <a href={iosUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    App Store에서 다운로드
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  iOS 앱을 App Store에 등록한 뒤, 해당 앱 페이지 URL(예: apps.apple.com/.../id123456789)을 환경 변수 NEXT_PUBLIC_DRIVER_APP_IOS_URL에 넣으면 여기에 링크가 나타납니다.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                앱은 기사 웹(<strong>/driver</strong>)과 동일한 기능을 제공하며, 설치 후 로그인하면 대시보드·배송 접수·정산 등을 모바일에서 이용할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

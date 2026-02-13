import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MapPin, Plus, ArrowLeft } from "lucide-react"
import { SavedAddressList } from "@/components/customer/saved-address-list"

export default async function SavedAddressesPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/customer">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">자주 쓰는 주소</h1>
        </div>

        <p className="text-sm text-muted-foreground">
          출발지·도착지를 등록해 두면 배송 요청 시 빠르게 선택할 수 있습니다.
        </p>

        <SavedAddressList />

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1">
            <Link
              href="/customer/address-search?type=pickup&returnTo=/customer/saved-addresses/add?type=pickup"
              className="inline-flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              출발지 추가
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link
              href="/customer/address-search?type=delivery&returnTo=/customer/saved-addresses/add?type=delivery"
              className="inline-flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              도착지 추가
            </Link>
          </Button>
        </div>

        <Button variant="ghost" asChild>
          <Link href="/customer">고객 메인으로</Link>
        </Button>
      </div>
    </div>
  )
}

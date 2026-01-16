import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { getRoleOverride } from "@/lib/role"

export default async function ReferralStatusPage({
  searchParams,
}: {
  searchParams?: { q?: string }
}) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    redirect("/")
  }

  const query = searchParams?.q?.trim()
  let referrals: any[] = []
  let error: { message: string } | null = null

  if (query) {
    const { data: matchedRiders, error: riderError } = await supabase
      .from("rider")
      .select("id")
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)

    const { data: matchedCustomers, error: customerError } = await supabase
      .from("customer")
      .select("id")
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)

    if (riderError) {
      error = riderError
    } else if (customerError) {
      error = customerError
    } else {
      const riderIds = (matchedRiders || []).map((r: any) => r.id)
      const customerIds = (matchedCustomers || []).map((c: any) => c.id)

      if (riderIds.length || customerIds.length) {
        let queryBuilder = supabase
          .from("customer_referral")
          .select("id, rider_id, customer_id, created_at")
          .order("created_at", { ascending: false })
          .limit(200)

        if (riderIds.length && customerIds.length) {
          queryBuilder = queryBuilder.or(
            `rider_id.in.(${riderIds.join(",")}),customer_id.in.(${customerIds.join(",")})`
          )
        } else if (riderIds.length) {
          queryBuilder = queryBuilder.in("rider_id", riderIds)
        } else if (customerIds.length) {
          queryBuilder = queryBuilder.in("customer_id", customerIds)
        }

        const { data: referralRows, error: referralError } = await queryBuilder

        if (referralError) {
          error = referralError
        } else {
          referrals = referralRows || []
        }
      }
    }
  } else {
    const { data: referralRows, error: referralError } = await supabase
      .from("customer_referral")
      .select("id, rider_id, customer_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200)

    if (referralError) {
      error = referralError
    } else {
      referrals = referralRows || []
    }
  }

  const riderIds = Array.from(new Set((referrals || []).map((r: any) => r.rider_id)))
  const customerIds = Array.from(new Set((referrals || []).map((r: any) => r.customer_id)))

  const { data: riders } = riderIds.length
    ? await supabase.from("rider").select("id, name, email").in("id", riderIds)
    : { data: [] }
  const { data: customers } = customerIds.length
    ? await supabase.from("customer").select("id, name, email").in("id", customerIds)
    : { data: [] }

  const riderMap = new Map((riders || []).map((r: any) => [r.id, r.name || r.email || r.id]))
  const customerMap = new Map((customers || []).map((c: any) => [c.id, c.name || c.email || c.id]))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-balance">고객 소개 현황</h1>
            <p className="text-muted-foreground mt-1">기사 → 고객 소개 관계</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">관리자 홈으로</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>고객 소개 현황</CardTitle>
            <CardDescription>기사 → 고객 소개 관계를 확인합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action="/admin/referrals" className="flex flex-col gap-2 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium" htmlFor="referral_search">
                  기사/고객 검색
                </label>
                <input
                  id="referral_search"
                  name="q"
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="이름 또는 이메일"
                  defaultValue={query}
                />
              </div>
              <Button type="submit" variant="outline">
                검색
              </Button>
            </form>
            {error ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                데이터를 불러오지 못했습니다: {error.message}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>기사</TableHead>
                    <TableHead>고객</TableHead>
                    <TableHead>소개일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals && referrals.length > 0 ? (
                    referrals.map((referral: any) => (
                      <TableRow key={referral.id}>
                        <TableCell>{riderMap.get(referral.rider_id) || referral.rider_id}</TableCell>
                        <TableCell>{customerMap.get(referral.customer_id) || referral.customer_id}</TableCell>
                        <TableCell>{new Date(referral.created_at).toLocaleString("ko-KR")}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        소개 관계가 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

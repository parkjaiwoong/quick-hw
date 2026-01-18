import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const { data: payouts } = await supabase
    .from("payout_requests")
    .select(
      `
      id,
      requested_amount,
      bank_account,
      bank_name,
      status,
      driver:profiles!payout_requests_driver_id_fkey(full_name, email, phone)
    `,
    )
    .in("status", ["pending", "approved"])
    .order("requested_at", { ascending: true })

  const header = ["기사명", "은행", "계좌번호", "출금액", "상태"]
  const rows = (payouts || []).map((payout: any) => [
    payout.driver?.full_name || payout.driver?.email || "기사",
    payout.bank_name || "",
    payout.bank_account || "",
    Number(payout.requested_amount || 0).toString(),
    payout.status,
  ])

  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
  const buffer = Buffer.from(csv, "utf-8")

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payout_requests.csv"`,
    },
  })
}

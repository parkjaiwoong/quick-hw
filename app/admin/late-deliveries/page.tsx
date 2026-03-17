import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"
import { getLateDeliveries } from "@/lib/actions/admin-late-deliveries"
import { LateDeliveriesClient } from "./late-deliveries-client"
import { AlertTriangle } from "lucide-react"

type SearchParams = { page?: string; date?: string; customer_name?: string; driver_name?: string }

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

export default async function LateDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams
}) {
  const params = await Promise.resolve(searchParams).then((p) => p ?? {})
  const page = Math.max(1, parseInt(String(params.page), 10) || 1)
  const dateParam = params.date?.trim() ?? ""
  const customerName = params.customer_name?.trim() ?? ""
  const driverName = params.driver_name?.trim() ?? ""

  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: profile }, roleOverride] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getRoleOverride(),
  ])
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) redirect("/")

  const dateForApi =
    dateParam !== ""
      ? dateParam
      : params.date === undefined
        ? todayString()
        : null
  const displayDate = dateParam !== "" ? dateParam : params.date === undefined ? todayString() : ""

  const result = await getLateDeliveries({
    page,
    pageSize: 20,
    date: dateForApi,
    customerName: customerName || null,
    driverName: driverName || null,
  })

  if (result?.error) {
    return (
      <div className="p-6">
        <p className="text-destructive">{result.error}</p>
      </div>
    )
  }

  const deliveries = result.deliveries ?? []
  const total = result.total ?? 0
  const pageSize = result.pageSize ?? 20

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
          예상시간 초과 배송
        </h1>
        <p className="text-muted-foreground mt-1">
          고객이 선택한 예상 완료 시간을 넘겨 완료된 배송 목록입니다. (급송 30분, 기본 3시간)
        </p>
      </div>

      <LateDeliveriesClient
        initialData={{
          deliveries,
          total,
          page,
          pageSize,
        }}
        initialFilters={{
          date: displayDate,
          customer_name: customerName,
          driver_name: driverName,
        }}
      />
    </div>
  )
}

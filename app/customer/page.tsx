import { Suspense } from "react"
import { CustomerDashboardShell } from "./_components/customer-dashboard-shell"
import { CustomerDashboardBody } from "./_components/customer-dashboard-body"
import { CustomerDashboardBodySkeleton } from "./_components/customer-dashboard-body-skeleton"

export default async function CustomerDashboard({
  searchParams,
}: {
  searchParams?: Promise<{ change?: string; until?: string; reason?: string }> | { change?: string; until?: string; reason?: string }
}) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : {}

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <CustomerDashboardShell />
      <Suspense fallback={<CustomerDashboardBodySkeleton />}>
        <CustomerDashboardBody searchParams={resolved} />
      </Suspense>
    </div>
  )
}

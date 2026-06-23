import { Suspense } from "react"
import { DriverDashboardShell } from "@/components/driver/driver-dashboard-shell"
import { DriverDashboardBody } from "@/components/driver/driver-dashboard-body"
import { DriverDashboardSkeleton } from "@/components/driver/driver-dashboard-skeleton"

type PageProps = { searchParams?: Promise<{ accept_delivery?: string }> }

export default async function DriverDashboard({ searchParams }: PageProps) {
  const params = await searchParams
  const acceptDeliveryId = params?.accept_delivery ?? null

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <DriverDashboardShell />
      <Suspense fallback={<DriverDashboardSkeleton />}>
        <DriverDashboardBody acceptDeliveryId={acceptDeliveryId} />
      </Suspense>
    </div>
  )
}

import { DriverDashboardShell } from "@/components/driver/driver-dashboard-shell"
import { DriverDashboardSkeleton } from "@/components/driver/driver-dashboard-skeleton"

export default function DriverLoading() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <DriverDashboardShell />
      <DriverDashboardSkeleton />
    </div>
  )
}

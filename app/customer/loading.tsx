import { CustomerDashboardShell } from "./_components/customer-dashboard-shell"
import { CustomerDashboardBodySkeleton } from "./_components/customer-dashboard-body-skeleton"

/** /customer 직접 진입 시에도 히어로는 즉시, 본문만 골격 */
export default function CustomerLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <CustomerDashboardShell />
      <CustomerDashboardBodySkeleton />
    </div>
  )
}

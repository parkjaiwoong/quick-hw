import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell"
import { AdminDashboardSkeleton } from "@/components/admin/admin-dashboard-skeleton"

export default function AdminLoading() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <AdminDashboardShell />
      <AdminDashboardSkeleton />
    </div>
  )
}

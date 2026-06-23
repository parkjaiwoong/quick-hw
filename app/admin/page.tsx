import { Suspense } from "react"
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell"
import { AdminDashboardBody } from "@/components/admin/admin-dashboard-body"
import { AdminDashboardSkeleton } from "@/components/admin/admin-dashboard-skeleton"

export default function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <AdminDashboardShell />
      <Suspense fallback={<AdminDashboardSkeleton />}>
        <AdminDashboardBody />
      </Suspense>
    </div>
  )
}

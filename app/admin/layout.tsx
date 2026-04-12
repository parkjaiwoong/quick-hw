import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"
import { AdminLayoutClient } from "@/components/admin/admin-layout-client"
import { getCachedAuthUser, getCachedProfileRow } from "@/lib/cache/server-session"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedAuthUser()
  if (!user) redirect("/auth/login")

  const [profile, roleOverride] = await Promise.all([getCachedProfileRow(user.id), getRoleOverride()])
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) redirect("/")

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}

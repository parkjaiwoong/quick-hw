import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"
import { CustomerLayoutClient } from "@/components/customer/customer-layout-client"
import { getCachedAuthUser, getCachedProfileRow } from "@/lib/cache/server-session"

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedAuthUser()
  if (!user) redirect("/auth/login")

  const [profile, roleOverride] = await Promise.all([getCachedProfileRow(user.id), getRoleOverride()])
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) redirect("/")

  return (
    <CustomerLayoutClient
      fullName={profile?.full_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
    >
      {children}
    </CustomerLayoutClient>
  )
}

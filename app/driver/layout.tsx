import { redirect } from "next/navigation"
import { getRoleOverride } from "@/lib/role"
import { DriverLayoutClient } from "@/components/driver/driver-layout-client"
import { getCachedAuthUser, getCachedProfileRow } from "@/lib/cache/server-session"

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedAuthUser()
  if (!user) redirect("/auth/login")

  const [profile, roleOverride] = await Promise.all([getCachedProfileRow(user.id), getRoleOverride()])
  const canActAsDriver = roleOverride === "driver" || profile?.role === "driver" || profile?.role === "admin"
  if (!canActAsDriver) redirect("/")

  return (
    <DriverLayoutClient
      fullName={profile?.full_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
    >
      {children}
    </DriverLayoutClient>
  )
}

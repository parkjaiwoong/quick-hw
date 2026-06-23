import { Suspense } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { getCompanyInfo } from "@/lib/actions/company"

async function AppShellWithCompany({ children }: { children: React.ReactNode }) {
  const companyInfo = await getCompanyInfo()
  return (
    <AppShell logoUrl={companyInfo?.logo_url} companyName={companyInfo?.company_name}>
      {children}
    </AppShell>
  )
}

function AppShellFallback({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

export { AppShellWithCompany, AppShellFallback }

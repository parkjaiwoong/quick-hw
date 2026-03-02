"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Footer } from "@/components/layout/footer"
import { NavigationProgress } from "@/components/layout/navigation-progress"

interface AppShellProps {
  children: React.ReactNode
  logoUrl?: string | null
  companyName?: string | null
}

export function AppShell({ children, logoUrl, companyName }: AppShellProps) {
  const pathname = usePathname()
  const isDriverDetailPage = pathname?.startsWith("/driver/delivery/")
  const showChrome = !isDriverDetailPage

  return (
    <>
      <NavigationProgress />
      {showChrome && <Header logoUrl={logoUrl} companyName={companyName} />}
      <main className={`${showChrome ? "pt-16 pb-16" : ""} min-h-screen`}>{children}</main>
      {showChrome && <BottomNav />}
      {showChrome && <Footer />}
    </>
  )
}

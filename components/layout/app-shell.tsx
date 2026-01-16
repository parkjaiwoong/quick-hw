"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Footer } from "@/components/layout/footer"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const isDriverDetailPage = pathname?.startsWith("/driver/delivery/")
  const showChrome = !isDriverDetailPage

  return (
    <>
      {showChrome && <Header />}
      <main className={`${showChrome ? "pt-16 pb-16" : ""} min-h-screen`}>{children}</main>
      {showChrome && <BottomNav />}
      {showChrome && <Footer />}
    </>
  )
}

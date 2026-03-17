"use client"

import Link from "next/link"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { DriverSidebarNav } from "@/components/driver/driver-sidebar-nav"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions/auth"
import { DriverScreenNotifier } from "@/components/driver/driver-screen-notifier"
import { LogOut } from "lucide-react"

export function DriverLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DriverScreenNotifier />
      <SidebarProvider defaultOpen={true}>
        <Sidebar side="left" collapsible="offcanvas" className="border-r">
          <SidebarHeader className="border-b p-2">
            <Button variant="ghost" size="sm" className="w-full justify-start font-semibold" asChild>
              <Link href="/driver">
                <span className="truncate">기사</span>
              </Link>
            </Button>
          </SidebarHeader>
          <SidebarContent>
            <DriverSidebarNav />
          </SidebarContent>
          <SidebarFooter className="border-t p-2">
            <form action={signOut} className="w-full">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-4 shrink-0" />
                <span>로그아웃</span>
              </Button>
            </form>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-muted-foreground md:inline-flex">
              배송원
            </span>
          </header>
          <div className="flex-1 overflow-auto bg-gradient-to-br from-blue-50/50 via-white to-yellow-50/50 p-4 md:p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}

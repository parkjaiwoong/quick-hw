"use client"

import Link from "next/link"
import Image from "next/image"
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
import { LogOut, User } from "lucide-react"

type DriverLayoutClientProps = {
  children: React.ReactNode
  fullName?: string | null
  avatarUrl?: string | null
}

export function DriverLayoutClient({ children, fullName, avatarUrl }: DriverLayoutClientProps) {
  const displayName = fullName?.trim() || "기사"

  return (
    <>
      <DriverScreenNotifier />
      <SidebarProvider defaultOpen={true}>
        <Sidebar side="left" collapsible="offcanvas" className="border-r">
          <SidebarHeader className="border-b p-2">
            <Button variant="ghost" size="sm" className="w-full justify-start font-semibold h-auto py-2" asChild>
              <Link href="/driver" className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 size-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 object-cover"
                      unoptimized
                    />
                  ) : (
                    <User className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="truncate">{displayName}</span>
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

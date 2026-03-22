"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { CustomerSidebarNav } from "@/components/customer/customer-sidebar-nav"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"

type CustomerLayoutClientProps = {
  children: React.ReactNode
  fullName?: string | null
  avatarUrl?: string | null
}

export function CustomerLayoutClient({ children, fullName, avatarUrl }: CustomerLayoutClientProps) {
  const displayName = fullName?.trim() || "고객"

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar side="left" collapsible="offcanvas" className="border-r">
        <SidebarHeader className="border-b p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start font-semibold h-auto py-2" asChild>
            <Link href="/customer" className="flex items-center gap-2 min-w-0">
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
          <CustomerSidebarNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-medium text-muted-foreground md:inline-flex">
            고객
          </span>
        </header>
        <div className="flex-1 overflow-auto bg-[#f8f9fa] p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

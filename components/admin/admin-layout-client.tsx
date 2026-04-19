"use client"

import Link from "next/link"
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions/auth"
import { LogOut } from "lucide-react"

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar side="left" collapsible="offcanvas" className="border-r">
        <SidebarHeader className="border-b p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start font-semibold" asChild>
            <Link href="/admin">
              <span className="truncate">관리자</span>
            </Link>
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <AdminSidebarNav />
        </SidebarContent>
        <SidebarFooter className="border-t p-2">
          <form action={signOut} className="w-full">
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <LogOut className="size-4 shrink-0" />
              <span>로그아웃</span>
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-5 md:px-8">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-medium text-muted-foreground md:inline-flex">
            관리자 / CS
          </span>
        </header>
        <div className="flex-1 overflow-auto bg-muted/40 p-5 md:p-8 lg:p-10">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

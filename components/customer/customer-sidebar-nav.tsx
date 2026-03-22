"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Home,
  Package,
  CreditCard,
  Coins,
  Megaphone,
  Truck,
  LayoutDashboard,
  LogOut,
  HelpCircle,
  ShieldAlert,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions/auth"
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react"
import { createClient } from "@/lib/supabase/client"

const menuGroups = [
  {
    label: "주문·배송",
    items: [
      { href: "/customer", label: "내 배송", icon: Package },
      { href: "/customer/new-delivery", label: "배송 요청", icon: Package },
    ],
  },
  {
    label: "결제·포인트",
    items: [
      { href: "/customer/payments", label: "결제 내역", icon: CreditCard },
      { href: "/customer/points", label: "포인트", icon: Coins },
    ],
  },
  {
    label: "고객센터",
    items: [
      { href: "/announcements", label: "공지사항", icon: Megaphone },
      { href: "/customer/inquiry", label: "문의하기", icon: HelpCircle },
      { href: "/customer/accident", label: "사고 접수", icon: ShieldAlert },
    ],
  },
]

export function CustomerSidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { setOpen, setOpenMobile } = useSidebar()
  const supabase = useMemo(() => createClient(), [])
  const mountedRef = useRef(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [roleOverride, setRoleOverride] = useState<string | null>(null)

  const getRoleFromCookie = useCallback(() => {
    if (typeof document === "undefined") return null
    const match = document.cookie.match(/(?:^|; )role_override=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [])

  useEffect(() => {
    setRoleOverride(getRoleFromCookie())
  }, [getRoleFromCookie])

  useEffect(() => {
    mountedRef.current = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.id || !mountedRef.current) return
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (mountedRef.current && data) setUserRole(data.role ?? null)
        })
    })
    return () => {
      mountedRef.current = false
    }
  }, [supabase])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user?.id) {
        startTransition(() => setUserRole(null))
        return
      }
      const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
      if (mountedRef.current && data) startTransition(() => setUserRole(data.role ?? null))
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const closeAndNavigate = () => {
    setOpenMobile(false)
    setOpen(false)
  }

  const setRoleCookie = (role: string) => {
    const maxAge = 60 * 60 * 24 * 30
    document.cookie = `role_override=${encodeURIComponent(role)}; path=/; max-age=${maxAge}`
    setRoleOverride(role)
  }

  const switchRole = async (role: string) => {
    setRoleCookie(role)
    await fetch("/api/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    if (role === "admin") router.push("/admin")
    if (role === "driver") router.push("/driver")
    if (role === "customer") router.push("/customer")
    closeAndNavigate()
  }

  const showRoleSwitcher = userRole === "admin"

  return (
    <>
      {showRoleSwitcher && (
        <SidebarGroup>
          <SidebarGroupLabel>모드 전환</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive>
                  <span className="cursor-default">
                    <LayoutDashboard className="size-4 shrink-0" />
                    <span>고객</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-4"
                  onClick={() => switchRole("driver")}
                >
                  <Truck className="size-4 shrink-0" />
                  <span>기사</span>
                  <ChevronRight className="ml-auto size-4 opacity-50" />
                </button>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-4"
                  onClick={() => switchRole("admin")}
                >
                  <LayoutDashboard className="size-4 shrink-0" />
                  <span>관리자</span>
                  <ChevronRight className="ml-auto size-4 opacity-50" />
                </button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      <SidebarGroup>
        <SidebarGroupLabel>바로가기</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/" && !pathname?.startsWith("/customer")}>
                <Link href="/" onClick={closeAndNavigate}>
                  <Home className="size-4 shrink-0" />
                  <span>홈</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {menuGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  item.href === "/customer"
                    ? pathname === "/customer"
                    : item.href === "/announcements"
                      ? pathname === "/announcements"
                      : pathname?.startsWith(item.href)
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={!!isActive}>
                      <Link href={item.href} onClick={closeAndNavigate}>
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}

      <SidebarGroup className="mt-auto">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <form action={signOut} className="w-full">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2"
                >
                  <LogOut className="size-4 shrink-0" />
                  <span>로그아웃</span>
                </Button>
              </form>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

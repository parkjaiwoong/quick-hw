"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { LayoutDashboard, Truck, Wallet, DollarSign, BookOpen, BarChart3, Megaphone, ShieldAlert } from "lucide-react"

const menuGroups = [
  {
    label: "배송",
    items: [
      { href: "/driver", label: "대시보드", icon: LayoutDashboard },
      { href: "/driver/available", label: "수락 가능 배송", icon: Truck },
      { href: "/driver/dashboard", label: "영업 성과", icon: BarChart3 },
    ],
  },
  {
    label: "정산 · 지갑",
    items: [
      { href: "/driver/settlements", label: "정산 내역", icon: DollarSign },
      { href: "/driver/wallet", label: "지갑 · 출금", icon: Wallet },
    ],
  },
  {
    label: "안내",
    items: [
      { href: "/driver/announcements", label: "공지사항", icon: Megaphone },
      { href: "/driver/guide", label: "가이드", icon: BookOpen },
      { href: "/driver/accident", label: "사고 신고", icon: ShieldAlert },
    ],
  },
]

export function DriverSidebarNav() {
  const pathname = usePathname()
  const { setOpen, setOpenMobile } = useSidebar()

  const closeAndNavigate = () => {
    setOpenMobile(false)
    setOpen(false)
  }

  return (
    <>
      {menuGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  item.href === "/driver"
                    ? pathname === "/driver"
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
    </>
  )
}

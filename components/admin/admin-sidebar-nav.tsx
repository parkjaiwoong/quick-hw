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
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Calculator,
  Banknote,
  FileText,
  Truck,
  Clock,
  DollarSign,
  MessageSquare,
  ShieldAlert,
  UserCog,
  Gift,
  Users,
  Coins,
  FileCheck,
  Megaphone,
  Calendar,
} from "lucide-react"

const menuGroups = [
  {
    label: "대시보드",
    items: [{ href: "/admin", label: "관리자 홈", icon: LayoutDashboard }],
  },
  {
    label: "회사 · 설정",
    items: [
      { href: "/admin/company", label: "회사 정보", icon: Building2 },
      { href: "/admin/pricing", label: "요금 설정", icon: DollarSign },
      { href: "/admin/announcements", label: "공지사항", icon: Megaphone },
      { href: "/admin/event-policy", label: "이벤트 정책", icon: Calendar },
    ],
  },
  {
    label: "결제 · 정산 · 출금",
    items: [
      { href: "/admin/payments", label: "결제 관리", icon: CreditCard },
      { href: "/admin/settlements", label: "정산 관리", icon: Calculator },
      { href: "/admin/payouts", label: "출금(지급) 관리", icon: Banknote },
      { href: "/admin/finance-logs", label: "금액 액션 로그", icon: FileText },
    ],
  },
  {
    label: "배송 · 연결",
    items: [
      { href: "/admin/dispatch", label: "연결 로그", icon: Truck },
      { href: "/admin/late-deliveries", label: "지연 배송", icon: Clock },
    ],
  },
  {
    label: "CS · 문의 · 사고",
    items: [
      { href: "/admin/inquiries", label: "문의 관리", icon: MessageSquare },
      { href: "/admin/accidents", label: "사고 접수", icon: ShieldAlert },
    ],
  },
  {
    label: "기사 · 리워드",
    items: [
      { href: "/admin/rider-change-requests", label: "기사 변경 요청", icon: UserCog },
      { href: "/admin/reward-policy", label: "리워드 정책", icon: Gift },
      { href: "/admin/rider-reward-policy", label: "기사 리워드 정책", icon: Gift },
      { href: "/admin/referrals", label: "소개 현황", icon: Users },
      { href: "/admin/rider-rewards", label: "기사 리워드", icon: Coins },
    ],
  },
  {
    label: "포인트",
    items: [
      { href: "/admin/point-history", label: "포인트 이력", icon: FileCheck },
      { href: "/admin/point-redemptions", label: "포인트 교환", icon: Coins },
    ],
  },
]

export function AdminSidebarNav() {
  const pathname = usePathname()

  return (
    <>
      {menuGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname?.startsWith(item.href)
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={!!isActive}>
                      <Link href={item.href}>
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

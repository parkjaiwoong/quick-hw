import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "퀵HW언넌 - 빠르고 안전한 퀵배송 서비스",
  description: "카카오T 스타일의 편리한 배송 요청과 실시간 추적으로 안심하고 이용하세요",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Supabase 세션은 쿠키로 관리되므로 localStorage 삭제 스크립트 제거 */}
      </head>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <AppShell>{children}</AppShell>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}

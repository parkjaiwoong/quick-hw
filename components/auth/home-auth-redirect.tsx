"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function getRoleOverrideClient(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)role_override=([^;]+)/)
  const value = m ? decodeURIComponent(m[1]) : null
  if (value === "admin" || value === "driver" || value === "customer") return value
  return null
}

/** 로그인 사용자는 랜딩 SSR 대기 없이 클라이언트에서 대시보드로 이동 */
export function HomeAuthRedirect() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (cancelled || !profile?.role) return
          const target = getRoleOverrideClient() ?? profile.role
          const path =
            target === "admin" ? "/admin" : target === "driver" ? "/driver" : "/customer"
          router.replace(path)
        })
    })
    return () => {
      cancelled = true
    }
  }, [router])

  return null
}

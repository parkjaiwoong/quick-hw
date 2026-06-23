"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { RoleOverride } from "@/lib/role"

export type LayoutProfile = {
  full_name: string | null
  avatar_url: string | null
  role: string | null
}

function getRoleOverrideClient(): RoleOverride | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/(?:^|;\s*)role_override=([^;]+)/)
  const value = m ? decodeURIComponent(m[1]) : null
  if (value === "admin" || value === "driver" || value === "customer") return value
  return null
}

/** 사이드바 프로필·역할 — 레이아웃 SSR 대기 없이 클라이언트에서 조회 */
export function useLayoutProfile() {
  const [profile, setProfile] = useState<LayoutProfile | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return
      supabase
        .from("profiles")
        .select("full_name, avatar_url, role")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data) setProfile(data)
        })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return profile
}

/** 역할 불일치 시 리다이렉트 (자식은 즉시 렌더 — 체감 속도 우선) */
export function useRoleGate(...allowed: ("admin" | "driver" | "customer")[]) {
  const router = useRouter()
  const allowedKey = allowed.join(",")

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        if (!cancelled) router.replace("/auth/login")
        return
      }
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (cancelled) return
          const override = getRoleOverrideClient()
          const effective = override ?? profile?.role
          const allowedList = allowedKey.split(",") as ("admin" | "driver" | "customer")[]
          if (!effective || !allowedList.includes(effective as (typeof allowedList)[number])) {
            router.replace("/")
          }
        })
    })
    return () => {
      cancelled = true
    }
  }, [allowedKey, router])
}

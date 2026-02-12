"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, LogOut } from "lucide-react"
import { signOut } from "@/lib/actions/auth"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthPage = pathname?.startsWith("/auth")
  const isDriverDetailPage = pathname?.startsWith("/driver/delivery/")
  const supabase = useMemo(() => createClient(), [])
  const mountedRef = useRef(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [roleOverride, setRoleOverride] = useState<string | null>(null)

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (!mountedRef.current) return

      if (error) {
        console.error("Header session check error:", error)
        setIsAuthenticated(false)
        setUserRole(null)
      } else {
        let sessionUser = session?.user ?? null
        if (!sessionUser) {
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          if (userError && userError.name !== "AuthSessionMissingError") {
            console.error("Header getUser error:", userError)
          } else {
            sessionUser = user ?? null
          }
        }
        const authenticated = !!sessionUser
        setIsAuthenticated(authenticated)
        console.log("Header session check:", authenticated, sessionUser?.id)
        if (authenticated && sessionUser?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", sessionUser.id)
            .maybeSingle()
          setUserRole(profile?.role ?? null)
        } else {
          setUserRole(null)
        }
      }
    } catch (error) {
      if (!mountedRef.current) return
      console.error("Header session check exception:", error)
      setIsAuthenticated(false)
      setUserRole(null)
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [supabase])

  useEffect(() => {
    mountedRef.current = true
    refreshSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (!mountedRef.current) return

      console.log("Header auth state changed:", _event, !!session)
      const authenticated = !!session
      setIsAuthenticated(authenticated)
      setIsLoading(false)
      if (authenticated && session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
        setUserRole(profile?.role ?? null)
      } else {
        setUserRole(null)
      }
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [refreshSession, supabase])

  useEffect(() => {
    refreshSession()
  }, [pathname, refreshSession])

  async function handleSignOut() {
    await signOut()
  }

  const currentRolePath = () => {
    if (pathname?.startsWith("/admin")) return "admin"
    if (pathname?.startsWith("/driver")) return "driver"
    if (pathname?.startsWith("/customer")) return "customer"
    return "admin"
  }

  const getRoleFromCookie = () => {
    if (typeof document === "undefined") return null
    const match = document.cookie.match(/(?:^|; )role_override=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  const setRoleCookie = (role: string) => {
    if (typeof document === "undefined") return
    const maxAge = 60 * 60 * 24 * 30
    document.cookie = `role_override=${encodeURIComponent(role)}; path=/; max-age=${maxAge}`
  }

  useEffect(() => {
    const cookieRole = getRoleFromCookie()
    setRoleOverride(cookieRole)
  }, [])

  useEffect(() => {
    const fallbackRole = pathname?.startsWith("/admin")
      ? "admin"
      : roleOverride || userRole || currentRolePath()
    if (fallbackRole && fallbackRole !== selectedRole) {
      setSelectedRole(fallbackRole)
    }
  }, [roleOverride, userRole, pathname, selectedRole])

  const showRoleSwitcher = isAuthenticated && userRole === "admin"

  if (isDriverDetailPage) {
    return null
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image src="/logo.svg" alt="퀵HW 로고" width={120} height={40} priority />
        </Link>

        {!isAuthPage && (
          <nav className="flex items-center gap-2">
            <Link href="/terms">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                약관
              </Button>
            </Link>
            {showRoleSwitcher && (
              <Select
                value={selectedRole || currentRolePath()}
                onValueChange={async (value) => {
                  setSelectedRole(value)
                  setRoleCookie(value)
                  setRoleOverride(value)
                  await fetch("/api/role", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: value }),
                  })
                  if (value === "admin") router.push("/admin")
                  if (value === "driver") router.push("/driver")
                  if (value === "customer") router.push("/customer")
                }}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="driver">기사</SelectItem>
                  <SelectItem value="customer">고객</SelectItem>
                </SelectContent>
              </Select>
            )}
            {isAuthenticated && (pathname?.startsWith("/customer") || userRole === "customer" || selectedRole === "customer") && (
              <Link href="/customer/new-delivery">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Package className="w-4 h-4" />
                  <span className="hidden sm:inline">배송 요청</span>
                </Button>
              </Link>
            )}
            {isLoading ? (
              <Button variant="outline" size="sm" disabled>
                <span className="hidden sm:inline">...</span>
              </Button>
            ) : isAuthenticated ? (
              <form action={handleSignOut}>
                <Button variant="outline" size="sm" type="submit" className="gap-2">
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">로그아웃</span>
                </Button>
              </form>
            ) : (
              <Link href="/auth/login">
                <Button variant="outline" size="sm">
                  로그인
                </Button>
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}

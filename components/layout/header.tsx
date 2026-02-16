"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, LogOut } from "lucide-react"
import { signOut } from "@/lib/actions/auth"
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react"
import { createClient } from "@/lib/supabase/client"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const isAuthPage = pathname?.startsWith("/auth")
  const isDriverDetailPage = pathname?.startsWith("/driver/delivery/")
  const supabase = useMemo(() => createClient(), [])
  const mountedRef = useRef(true)
  const loadingClearedRef = useRef(false)
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
        startTransition(() => {
          setIsAuthenticated(false)
          setUserRole(null)
          setIsLoading(false)
        })
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
        console.log("Header session check:", authenticated, sessionUser?.id)
        if (authenticated && sessionUser?.id) {
          // 로딩 먼저 해제하고 역할은 비동기로 채움 (프로필 지연 시 로딩에 갇히지 않도록)
          startTransition(() => {
            loadingClearedRef.current = true
            setIsAuthenticated(true)
            setIsLoading(false)
          })
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", sessionUser.id)
            .maybeSingle()
          if (mountedRef.current) {
            startTransition(() => setUserRole(profile?.role ?? null))
          }
        } else {
          startTransition(() => {
            loadingClearedRef.current = true
            setIsAuthenticated(authenticated)
            setUserRole(null)
            setIsLoading(false)
          })
        }
      }
    } catch (error) {
      if (!mountedRef.current) return
      console.error("Header session check exception:", error)
      startTransition(() => {
        loadingClearedRef.current = true
        setIsAuthenticated(false)
        setUserRole(null)
        setIsLoading(false)
      })
    }
  }, [supabase])

  useEffect(() => {
    mountedRef.current = true
    loadingClearedRef.current = false
    refreshSession()

    const timeoutId = setTimeout(async () => {
      if (!mountedRef.current || loadingClearedRef.current) return
      const { data: { session } } = await supabase.auth.getSession()
      const p = pathnameRef.current
      const roleFromPath = p?.startsWith("/driver") ? "driver" : p?.startsWith("/customer") ? "customer" : p?.startsWith("/admin") ? "admin" : null
      startTransition(() => {
        loadingClearedRef.current = true
        setIsAuthenticated(!!session?.user)
        setUserRole(roleFromPath)
        setIsLoading(false)
      })
    }, 2500)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (!mountedRef.current) return

      console.log("Header auth state changed:", _event, !!session)
      const authenticated = !!session
      startTransition(() => {
        loadingClearedRef.current = true
        setIsAuthenticated(authenticated)
        setIsLoading(false)
      })
      if (authenticated && session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
        if (mountedRef.current) {
          startTransition(() => setUserRole(profile?.role ?? null))
        }
      } else {
        startTransition(() => setUserRole(null))
      }
    })

    return () => {
      mountedRef.current = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [refreshSession, supabase])

  // pathname마다 세션 재조회 제거 → INP 개선 (클릭 시 메인 스레드 블로킹 방지)
  // 마운트·auth 변경 시에만 refreshSession 호출됨

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
              <Button variant="outline" size="sm" disabled className="gap-2">
                <LogOut className="w-4 h-4" />
                <span className="text-xs">로딩 중</span>
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

"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, Package, Truck, LayoutDashboard, User, DollarSign, LogOut, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { signOut } from "@/lib/actions/auth"

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthPage = pathname?.startsWith("/auth")
  const isDriverDetailPage = pathname?.startsWith("/driver/delivery/")
  const supabase = useMemo(() => createClient(), [])
  const mountedRef = useRef(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (!mountedRef.current) return

      if (error) {
        console.error("BottomNav session check error:", error)
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
            console.error("BottomNav getUser error:", userError)
          } else {
            sessionUser = user ?? null
          }
        }
        const authenticated = !!sessionUser
        console.log("BottomNav session check:", authenticated, sessionUser?.id)

        if (sessionUser) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", sessionUser.id)
            .maybeSingle()

          if (profileError) {
            console.error("Profile fetch error:", profileError)
            startTransition(() => {
              setUserRole(null)
              setIsAuthenticated(authenticated)
              setIsLoading(false)
            })
          } else {
            startTransition(() => {
              setIsAuthenticated(authenticated)
              setUserRole(profile?.role || null)
              console.log("User role:", profile?.role)
              setIsLoading(false)
            })
          }
        } else {
          startTransition(() => {
            setIsAuthenticated(authenticated)
            setUserRole(null)
            setIsLoading(false)
          })
        }
      }
    } catch (error) {
      if (!mountedRef.current) return
      console.error("BottomNav session check exception:", error)
      startTransition(() => {
        setIsAuthenticated(false)
        setUserRole(null)
        setIsLoading(false)
      })
    }
  }, [supabase])

  useEffect(() => {
    mountedRef.current = true
    refreshSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (!mountedRef.current) return

      console.log("BottomNav auth state changed:", _event, !!session)
      const authenticated = !!session

      if (session?.user) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data: profile, error: profileError }) => {
            if (!mountedRef.current) return
            if (profileError) {
              console.error("Profile fetch error in onAuthStateChange:", profileError)
            }
            startTransition(() => {
              setIsAuthenticated(true)
              setUserRole(profileError ? null : (profile?.role ?? null))
              setIsLoading(false)
            })
          })
      } else {
        startTransition(() => {
          setIsAuthenticated(authenticated)
          setUserRole(null)
          setIsLoading(false)
        })
      }
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [refreshSession, supabase])

  // pathname마다 세션 재조회 제거 → INP 개선 (클릭 시 메인 스레드 블로킹 방지)

  if (isAuthPage || isDriverDetailPage) return null

  const isCustomerRoute = pathname?.startsWith("/customer")
  const isDriverRoute = pathname?.startsWith("/driver")
  const isAdminRoute = pathname?.startsWith("/admin")

  // 내 정보 링크 결정
  const getProfileLink = () => {
    if (!isAuthenticated) return "/auth/login"
    if (userRole === "customer") return "/customer"
    if (userRole === "driver") return "/driver"
    if (userRole === "admin") return "/admin"
    return "/auth/login"
  }

  async function handleSignOut() {
    await signOut()
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around h-16">
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
              pathname === "/" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">홈</span>
          </Link>

          {isCustomerRoute && (
            <>
              <Link
                href="/customer"
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  pathname === "/customer"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Package className="w-5 h-5" />
                <span className="text-xs">내 배송</span>
              </Link>
              <Link
                href="/customer/new-delivery"
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  pathname === "/customer/new-delivery"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Package className="w-5 h-5" />
                <span className="text-xs">배송 요청</span>
              </Link>
            </>
          )}

          {isDriverRoute && (
            <>
              <Link
                href="/driver"
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  pathname === "/driver" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Truck className="w-5 h-5" />
                <span className="text-xs">배송 관리</span>
              </Link>
              <Link
                href="/driver/settlements"
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  pathname === "/driver/settlements"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <DollarSign className="w-5 h-5" />
                <span className="text-xs">정산</span>
              </Link>
              <Link
                href="/driver/wallet"
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  pathname === "/driver/wallet" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Wallet className="w-5 h-5" />
                <span className="text-xs">지갑/출금</span>
              </Link>
            </>
          )}

          {isAdminRoute && (
            <Link
              href="/admin"
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                pathname === "/admin" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-xs">대시보드</span>
            </Link>
          )}

          {isLoading ? (
            <Link
              href="/auth/login"
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                "text-muted-foreground opacity-50"
              )}
            >
              <User className="w-5 h-5" />
              <span className="text-xs">로딩...</span>
            </Link>
          ) : isAuthenticated ? (
            <form action={handleSignOut} className="flex-1">
              <button
                type="submit"
                className={cn(
                  "w-full flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                <LogOut className="w-5 h-5" />
                <span className="text-xs">로그아웃</span>
              </button>
            </form>
          ) : (
            <Link
              href="/auth/login"
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                pathname?.startsWith("/auth")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <User className="w-5 h-5" />
              <span className="text-xs">로그인</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

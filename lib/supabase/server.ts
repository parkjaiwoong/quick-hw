import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/** ECONNRESET 등 일시적 네트워크 오류 시 재시도하는 fetch 래퍼 (Vercel + Supabase) — proxy에서도 사용 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 2,
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(input, init)
      return res
    } catch (e) {
      const err = e as { cause?: { code?: string }; code?: string }
      const code = err?.cause?.code ?? err?.code
      const isRetryable = code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT"
      if (!isRetryable || i === retries) throw e
      await new Promise((r) => setTimeout(r, 100 * (i + 1)))
    }
  }
  throw new Error("fetch failed after retries")
}

export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_QUICKSUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Please check your .env.local file:\n" +
      "- NEXT_PUBLIC_QUICKSUPABASE_URL\n" +
      "- NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY\n\n" +
      "Get these values from: https://supabase.com/dashboard/project/_/settings/api"
    )
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: { fetch: fetchWithRetry as typeof fetch },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Component에서 호출된 경우 무시
          }
        },
      },
    },
  )
}

export const getSupabaseServerClient = createClient

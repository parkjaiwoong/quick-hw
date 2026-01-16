import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

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

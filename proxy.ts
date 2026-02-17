import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_URL && `https://www.${process.env.VERCEL_URL}`,
  "https://quick-hw.vercel.app",
  "https://www.quick-hw.vercel.app",
  "https://your-app.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
].filter(Boolean) as string[]

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o))
      ? origin
      : ALLOWED_ORIGINS[0] ?? "http://localhost:3000"
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  }
}

export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/")
  const origin = request.headers.get("origin")
  const cors = getCorsHeaders(origin)

  if (request.method === "OPTIONS" && isApi) {
    return new NextResponse(null, { status: 204, headers: cors })
  }

  const response = await updateSession(request)
  if (isApi) {
    Object.entries(cors).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}

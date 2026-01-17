import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { handleRiderUrlAccess } from "@/lib/actions/rider-referral"

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const cookieStore = await cookies()
  const existingSession = cookieStore.get("rider_referral_session")?.value
  const sessionId = existingSession || crypto.randomUUID()
  let riderCode = typeof params?.code === "string" ? params.code.trim() : ""
  if (!riderCode) {
    const pathname = new URL(request.url).pathname
    const segments = pathname.split("/").filter(Boolean)
    const lastSegment = segments[segments.length - 1]
    if (segments[0] === "r" && lastSegment && lastSegment !== "r") {
      riderCode = lastSegment.trim()
    }
  }

  if (!riderCode) {
    const reasonParam = `&reason=${encodeURIComponent("missing_code")}`
    return NextResponse.redirect(new URL(`/?referral=blocked${reasonParam}`, request.url))
  }

  const result = await handleRiderUrlAccess(riderCode, {
    sessionId,
    skipCookie: true,
  })

  if (result.status === "assigned" || result.status === "already_assigned") {
    return NextResponse.redirect(new URL("/customer", request.url))
  }

  if (result.status === "cookie_only") {
    const response = NextResponse.redirect(new URL(`/?referral=${encodeURIComponent(riderCode)}`, request.url))
    response.cookies.set("rider_referral_code", riderCode, { path: "/", maxAge: 60 * 60 * 24 * 30 })
    if (!existingSession) {
      response.cookies.set("rider_referral_session", sessionId, { path: "/", maxAge: 60 * 60 * 24 * 30 })
    }
    return response
  }

  const reasonParam = result.reason ? `&reason=${encodeURIComponent(result.reason)}` : ""
  return NextResponse.redirect(new URL(`/?referral=blocked${reasonParam}`, request.url))
}

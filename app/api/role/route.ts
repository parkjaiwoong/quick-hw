import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const allowedRoles = new Set(["admin", "driver", "customer"])

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const role = typeof body?.role === "string" ? body.role : null

  if (!role || !allowedRoles.has(role)) {
    cookies().delete("role_override")
    return NextResponse.json({ ok: true, role: null })
  }

  cookies().set("role_override", role, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  })

  return NextResponse.json({ ok: true, role })
}

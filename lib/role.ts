import { cookies } from "next/headers"

export type RoleOverride = "admin" | "driver" | "customer"

export async function getRoleOverride(): Promise<RoleOverride | null> {
  const store = await cookies()
  const value = store.get("role_override")?.value
  if (value === "admin" || value === "driver" || value === "customer") {
    return value
  }
  return null
}

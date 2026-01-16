"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getRoleOverride } from "@/lib/role"
import { revalidatePath } from "next/cache"

function toRatePercent(value: FormDataEntryValue | null) {
  const percent = Number(value)
  if (!Number.isFinite(percent) || percent < 0) return 0
  return percent / 100
}

function toDateValue(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : ""
  return text ? new Date(text).toISOString() : null
}

export async function getEventPolicies() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("event_policy")
    .select("id, name, event_reward_rate, status, start_at, end_at, stackable, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { events: data }
}

export async function createEventPolicy(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("인증이 필요합니다")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    throw new Error("권한이 없습니다")
  }

  const name = String(formData.get("name") || "").trim()
  if (!name) {
    throw new Error("이벤트 이름이 필요합니다")
  }

  const eventRewardRate = toRatePercent(formData.get("event_reward_rate"))
  const status = String(formData.get("status") || "scheduled")
  const startAt = toDateValue(formData.get("start_at"))
  const endAt = toDateValue(formData.get("end_at"))
  const stackable = formData.get("stackable") === "on"

  const { error } = await supabase.from("event_policy").insert({
    name,
    event_reward_rate: eventRewardRate,
    status,
    start_at: startAt,
    end_at: endAt,
    stackable,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/event-policy")
}

export async function updateEventStatus(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("인증이 필요합니다")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    throw new Error("권한이 없습니다")
  }

  const id = String(formData.get("id") || "").trim()
  const status = String(formData.get("status") || "").trim()
  if (!id || !status) {
    throw new Error("필수 값이 누락되었습니다")
  }

  const { error } = await supabase
    .from("event_policy")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/event-policy")
}

export async function syncEventPolicyStatus(): Promise<void> {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    return
  }

  const { data: events, error } = await supabase
    .from("event_policy")
    .select("id, status, start_at, end_at")

  if (error || !events) {
    return
  }

  const now = new Date()
  const updates = events
    .map((event: any) => {
      const startAt = event.start_at ? new Date(event.start_at) : null
      const endAt = event.end_at ? new Date(event.end_at) : null

      if (!startAt && !endAt) {
        return null
      }

      let nextStatus = event.status

      if (endAt && endAt < now) {
        nextStatus = "ended"
      } else if (startAt && startAt <= now && (!endAt || endAt >= now)) {
        nextStatus = "active"
      } else if (startAt && startAt > now) {
        nextStatus = "scheduled"
      }

      if (nextStatus === event.status) {
        return null
      }

      return { id: event.id, status: nextStatus }
    })
    .filter(Boolean) as { id: string; status: string }[]

  if (!updates.length) {
    return
  }

  await Promise.all(
    updates.map((update) =>
      supabase.from("event_policy").update({ status: update.status, updated_at: now.toISOString() }).eq("id", update.id)
    )
  )

  revalidatePath("/admin/event-policy")
}

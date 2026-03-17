"use server"

import { getSupabaseServerClient, getServiceRoleClient } from "@/lib/supabase/server"
import { enrichLateDeliveries } from "./admin-late-deliveries-helper.js"

const PAGE_SIZE = 20

/** 예상 완료 시각을 넘겨서 완료된 배송 목록 (관리자용). 일자/고객명/기사명 필터, 페이징 지원 */
export async function getLateDeliveries(opts: {
  page?: number
  pageSize?: number
  date?: string | null
  customerName?: string | null
  driverName?: string | null
}) {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? PAGE_SIZE))
  const supabase = await getSupabaseServerClient()
  const adminClient = await getServiceRoleClient()
  const client = adminClient ?? supabase

  let customerIds: string[] | null = null
  if (opts.customerName?.trim()) {
    const q = client
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${opts.customerName.trim()}%,email.ilike.%${opts.customerName.trim()}%`)
    const { data: profiles } = await q
    customerIds = (profiles ?? []).map((p) => p.id)
    if (customerIds.length === 0) return { deliveries: [], total: 0, page, pageSize }
  }

  let driverIds: string[] | null = null
  if (opts.driverName?.trim()) {
    const q = client
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${opts.driverName.trim()}%,email.ilike.%${opts.driverName.trim()}%`)
    const { data: profiles } = await q
    driverIds = (profiles ?? []).map((p) => p.id)
    if (driverIds.length === 0) return { deliveries: [], total: 0, page, pageSize }
  }

  let query = client
    .from("deliveries")
    .select(
      "id, status, created_at, accepted_at, delivered_at, expected_delivery_minutes, urgency, customer_id, driver_id, pickup_address, delivery_address, pickup_location, delivery_location, total_fee, driver_fee",
    )
    .eq("status", "delivered")
    .not("accepted_at", "is", null)
    .not("delivered_at", "is", null)
    .order("delivered_at", { ascending: false })
    .limit(2000)

  if (opts.date?.trim()) {
    const day = opts.date.trim()
    query = query.gte("delivered_at", `${day}T00:00:00`).lte("delivered_at", `${day}T23:59:59.999`)
  }
  if (customerIds?.length) query = query.in("customer_id", customerIds)
  if (driverIds?.length) query = query.in("driver_id", driverIds)

  const { data: rows, error } = await query

  if (error) return { error: error.message }

  const minutes = (d: { expected_delivery_minutes?: number | null; urgency?: string | null }) =>
    d.expected_delivery_minutes ?? (d.urgency === "express" ? 30 : 180)

  const late = (rows ?? []).filter((d) => {
    const accepted = new Date(d.accepted_at!).getTime()
    const delivered = new Date(d.delivered_at!).getTime()
    const expectedBy = accepted + minutes(d) * 60 * 1000
    return delivered > expectedBy
  })

  const userIds = Array.from(
    new Set(late.flatMap((d) => [d.customer_id, d.driver_id].filter(Boolean) as string[])),
  )
  const profileMap = new Map<string, { full_name?: string | null; email?: string | null; phone?: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, full_name, email, phone")
      .in("id", userIds)
    ;(profiles ?? []).forEach((p) => profileMap.set(p.id, p))
  }

  const all = enrichLateDeliveries(late, profileMap)
  const total = all.length
  const start = (page - 1) * pageSize
  const pageDeliveryIds = all.slice(start, start + pageSize).map((d: { id: string }) => d.id)

  const paymentMap = new Map<string, { status?: string }>()
  const settlementMap = new Map<string, { settlement_status?: string }>()
  if (pageDeliveryIds.length > 0) {
    const [payRes, setRes] = await Promise.all([
      client.from("payments").select("delivery_id, status").in("delivery_id", pageDeliveryIds).order("created_at", { ascending: false }),
      client.from("settlements").select("delivery_id, settlement_status").in("delivery_id", pageDeliveryIds),
    ])
    for (const p of payRes.data ?? []) {
      if (!paymentMap.has((p as { delivery_id: string }).delivery_id)) {
        paymentMap.set((p as { delivery_id: string }).delivery_id, { status: (p as { status?: string }).status })
      }
    }
    for (const s of setRes.data ?? []) {
      settlementMap.set((s as { delivery_id: string }).delivery_id, { settlement_status: (s as { settlement_status?: string }).settlement_status })
    }
  }

  const deliveries = all.slice(start, start + pageSize).map((d: Record<string, unknown>) => ({
    ...d,
    payment: paymentMap.get((d.id as string)) ?? null,
    settlement: settlementMap.get((d.id as string)) ?? null,
  }))

  return { deliveries, total, page, pageSize }
}

"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { Announcement } from "@/lib/actions/announcements"

function isRpcMissingError(msg: string) {
  return /function .* does not exist|schema cache|PGRST202|42883/i.test(msg)
}

export type DriverDashboardHomeBundle = {
  driverInfo: Record<string, unknown> | null
  riderCode: string | null
  available: unknown[]
  assigned: unknown[]
  recent: unknown[]
  accidents: unknown[]
}

export async function fetchDriverDashboardHomeRpc(): Promise<
  { ok: true; data: DriverDashboardHomeBundle } | { ok: false; error: string; rpcMissing?: boolean }
> {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_driver_dashboard_home")
  if (error) {
    return { ok: false, error: error.message, rpcMissing: isRpcMissingError(error.message) }
  }
  const raw = data as Record<string, unknown> | null
  if (!raw || typeof raw !== "object") return { ok: false, error: "empty" }
  if (raw.error === "not_authenticated") return { ok: false, error: "not_authenticated" }
  return {
    ok: true,
    data: {
      driverInfo: (raw.driver_info as Record<string, unknown>) ?? null,
      riderCode: (raw.rider_code as string) ?? null,
      available: Array.isArray(raw.available_deliveries) ? raw.available_deliveries : [],
      assigned: Array.isArray(raw.assigned_deliveries) ? raw.assigned_deliveries : [],
      recent: Array.isArray(raw.recent_deliveries) ? raw.recent_deliveries : [],
      accidents: Array.isArray(raw.accidents) ? raw.accidents : [],
    },
  }
}

export type DriverAvailableBundle = {
  driverInfo: Record<string, unknown> | null
  available: unknown[]
  profileRole: string | null
}

export async function fetchDriverAvailablePageRpc(): Promise<
  { ok: true; data: DriverAvailableBundle } | { ok: false; error: string; rpcMissing?: boolean }
> {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_driver_available_page_data")
  if (error) {
    return { ok: false, error: error.message, rpcMissing: isRpcMissingError(error.message) }
  }
  const raw = data as Record<string, unknown> | null
  if (!raw || typeof raw !== "object") return { ok: false, error: "empty" }
  if (raw.error === "not_authenticated") return { ok: false, error: "not_authenticated" }
  return {
    ok: true,
    data: {
      driverInfo: (raw.driver_info as Record<string, unknown>) ?? null,
      available: Array.isArray(raw.available_deliveries) ? raw.available_deliveries : [],
      profileRole: (raw.profile_role as string) ?? null,
    },
  }
}

export async function fetchAnnouncementsPageRpc(roleOverride: string | null): Promise<
  { ok: true; announcements: Announcement[] } | { ok: false; error: string; rpcMissing?: boolean }
> {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_announcements_page_data", {
    p_role_override: roleOverride ?? null,
  })
  if (error) {
    return { ok: false, error: error.message, rpcMissing: isRpcMissingError(error.message) }
  }
  const raw = data as Record<string, unknown> | null
  if (!raw || typeof raw !== "object") return { ok: false, error: "empty" }
  if (raw.error === "not_authenticated") return { ok: false, error: "not_authenticated" }
  const list = raw.announcements
  return {
    ok: true,
    announcements: Array.isArray(list) ? (list as Announcement[]) : [],
  }
}

export type DriverAccidentBundle = {
  deliveries: { id: string; pickup_address?: string; delivery_address?: string; status: string; created_at: string }[]
  accidents: {
    id: string
    accident_type: string
    accident_description: string
    created_at: string
    status: string
    photos?: unknown
    delivery?: { id?: string; pickup_address?: string; delivery_address?: string } | null
  }[]
  profileRole: string | null
}

export async function fetchDriverAccidentPageRpc(): Promise<
  { ok: true; data: DriverAccidentBundle } | { ok: false; error: string; rpcMissing?: boolean }
> {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_driver_accident_page_data")
  if (error) {
    return { ok: false, error: error.message, rpcMissing: isRpcMissingError(error.message) }
  }
  const raw = data as Record<string, unknown> | null
  if (!raw || typeof raw !== "object") return { ok: false, error: "empty" }
  if (raw.error === "not_authenticated") return { ok: false, error: "not_authenticated" }
  return {
    ok: true,
    data: {
      deliveries: Array.isArray(raw.deliveries) ? (raw.deliveries as DriverAccidentBundle["deliveries"]) : [],
      accidents: Array.isArray(raw.accidents) ? (raw.accidents as DriverAccidentBundle["accidents"]) : [],
      profileRole: (raw.profile_role as string) ?? null,
    },
  }
}

export type CustomerPaymentsPageBundle = {
  payments: unknown[]
}

export async function fetchCustomerPaymentsPageRpc(roleOverride: string | null): Promise<
  { ok: true; data: CustomerPaymentsPageBundle } | { ok: false; error: string; rpcMissing?: boolean }
> {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_customer_payments_page_data", {
    p_role_override: roleOverride ?? null,
  })
  if (error) {
    return { ok: false, error: error.message, rpcMissing: isRpcMissingError(error.message) }
  }
  const raw = data as Record<string, unknown> | null
  if (!raw || typeof raw !== "object") return { ok: false, error: "empty" }
  if (raw.error === "not_authenticated") return { ok: false, error: "not_authenticated" }
  if (raw.error === "forbidden") return { ok: false, error: "forbidden" }
  return {
    ok: true,
    data: {
      payments: Array.isArray(raw.payments) ? raw.payments : [],
    },
  }
}

export type CustomerPointsPageBundle = {
  balance: number
  history: unknown[]
  redemptions: unknown[]
}

export async function fetchCustomerPointsPageRpc(roleOverride: string | null): Promise<
  { ok: true; data: CustomerPointsPageBundle } | { ok: false; error: string; rpcMissing?: boolean }
> {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_customer_points_page_data", {
    p_role_override: roleOverride ?? null,
  })
  if (error) {
    return { ok: false, error: error.message, rpcMissing: isRpcMissingError(error.message) }
  }
  const raw = data as Record<string, unknown> | null
  if (!raw || typeof raw !== "object") return { ok: false, error: "empty" }
  if (raw.error === "not_authenticated") return { ok: false, error: "not_authenticated" }
  if (raw.error === "forbidden") return { ok: false, error: "forbidden" }
  const bal = raw.balance
  return {
    ok: true,
    data: {
      balance: typeof bal === "number" ? bal : Number(bal ?? 0),
      history: Array.isArray(raw.history) ? raw.history : [],
      redemptions: Array.isArray(raw.redemptions) ? raw.redemptions : [],
    },
  }
}

export type CustomerReferralPageBundle = {
  referral: Record<string, unknown> | null
}

export async function fetchCustomerReferralPageRpc(roleOverride: string | null): Promise<
  { ok: true; data: CustomerReferralPageBundle } | { ok: false; error: string; rpcMissing?: boolean }
> {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_customer_referral_page_data", {
    p_role_override: roleOverride ?? null,
  })
  if (error) {
    return { ok: false, error: error.message, rpcMissing: isRpcMissingError(error.message) }
  }
  const raw = data as Record<string, unknown> | null
  if (!raw || typeof raw !== "object") return { ok: false, error: "empty" }
  if (raw.error === "not_authenticated") return { ok: false, error: "not_authenticated" }
  if (raw.error === "forbidden") return { ok: false, error: "forbidden" }
  const ref = raw.referral
  return {
    ok: true,
    data: {
      referral: ref && typeof ref === "object" ? (ref as Record<string, unknown>) : null,
    },
  }
}

export type AdminDashboardBundle = {
  totalDeliveries: number
  activeDeliveries: number
  customers: number
  drivers: number
  accidents: number
  inquiries: number
  recentDeliveries: unknown[] | null
  recentAccidents: unknown[] | null
  recentInquiries: unknown[] | null
  pendingSettlementCount: number
  pendingPayoutCount: number
  pendingPayoutAmount: number
}

export async function fetchAdminDashboardBundleRpc(roleOverride: string | null): Promise<
  { ok: true; data: AdminDashboardBundle } | { ok: false; error: string; rpcMissing?: boolean }
> {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_admin_dashboard_bundle", {
    p_role_override: roleOverride ?? null,
  })
  if (error) {
    return { ok: false, error: error.message, rpcMissing: isRpcMissingError(error.message) }
  }
  const raw = data as Record<string, unknown> | null
  if (!raw || typeof raw !== "object") return { ok: false, error: "empty" }
  if (raw.error === "not_authenticated") return { ok: false, error: "not_authenticated" }
  if (raw.error === "forbidden") return { ok: false, error: "forbidden" }
  const num = (k: string) => {
    const v = raw[k]
    return typeof v === "number" ? v : Number(v ?? 0)
  }
  return {
    ok: true,
    data: {
      totalDeliveries: num("total_deliveries"),
      activeDeliveries: num("active_deliveries"),
      customers: num("customers"),
      drivers: num("drivers"),
      accidents: num("accidents"),
      inquiries: num("inquiries"),
      recentDeliveries: Array.isArray(raw.recent_deliveries) ? raw.recent_deliveries : [],
      recentAccidents: Array.isArray(raw.recent_accidents) ? raw.recent_accidents : [],
      recentInquiries: Array.isArray(raw.recent_inquiries) ? raw.recent_inquiries : [],
      pendingSettlementCount: num("pending_settlement_count"),
      pendingPayoutCount: num("pending_payout_count"),
      pendingPayoutAmount: num("pending_payout_amount"),
    },
  }
}

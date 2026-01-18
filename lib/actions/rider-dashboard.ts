"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

export type RiderDashboardPeriod = "this_month" | "last_month" | "all"

export type RiderDashboardKpi = {
  total_customers: number
  period_new_customers: number
  period_orders: number
  period_reward: number
  total_reward: number
}

export type RiderDashboardCustomerRow = {
  customer_id: string
  customer_name: string
  last_order_at: string | null
  period_order_count: number
  is_active: boolean
}

const normalizePeriod = (period?: string): RiderDashboardPeriod => {
  if (period === "last_month" || period === "all") return period
  return "this_month"
}

export async function getRiderDashboardKpi(period?: string) {
  const supabase = await getSupabaseServerClient()
  const normalized = normalizePeriod(period)

  const { data, error } = await supabase.rpc("rider_dashboard_kpi", {
    p_period: normalized,
  })

  if (error) {
    return { data: null as RiderDashboardKpi | null, error: error.message, period: normalized }
  }

  return { data: data as RiderDashboardKpi, error: null as string | null, period: normalized }
}

export async function getRiderDashboardCustomers(period?: string) {
  const supabase = await getSupabaseServerClient()
  const normalized = normalizePeriod(period)

  const { data, error } = await supabase.rpc("rider_dashboard_customers", {
    p_period: normalized,
  })

  if (error) {
    return { data: [] as RiderDashboardCustomerRow[], error: error.message, period: normalized }
  }

  return { data: (data || []) as RiderDashboardCustomerRow[], error: null as string | null, period: normalized }
}

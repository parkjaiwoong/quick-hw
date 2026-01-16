"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function getDeliveryTracking(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("delivery_tracking")
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return { error: error.message }
  }

  return { tracking: data }
}

export async function getDeliveryDetails(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("deliveries")
    .select(
      `
      *,
      customer:profiles!deliveries_customer_id_fkey(full_name, phone),
      driver:profiles!deliveries_driver_id_fkey(full_name, phone)
    `,
    )
    .eq("id", deliveryId)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { delivery: data }
}

export async function getDeliveryForDriver(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase.from("deliveries").select("*").eq("id", deliveryId).single()

  if (error) {
    return { error: error.message }
  }

  return { delivery: data }
}

export async function getDeliveryForCustomer(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase.from("deliveries").select("*").eq("id", deliveryId).single()

  if (error) {
    return { error: error.message }
  }

  return { delivery: data }
}

export async function subscribeToDeliveryUpdates(deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  // Supabase Realtime을 통한 구독 설정
  // 클라이언트에서 사용할 수 있도록 deliveryId 반환
  return { deliveryId }
}

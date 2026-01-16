"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function handleOrderCompleted(orderId: string) {
  const supabase = await getSupabaseServerClient()

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId)

  if (updateError) {
    return { error: updateError.message }
  }

  const { error: rpcError } = await supabase.rpc("calculate_rewards_for_order", {
    p_order_id: orderId,
  })

  if (rpcError) {
    return { error: rpcError.message }
  }

  return { success: true }
}

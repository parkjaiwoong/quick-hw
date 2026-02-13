"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

export type SavedAddressType = "pickup" | "delivery"

export interface SavedAddress {
  id: string
  label: string
  address: string
  lat: number
  lng: number
  address_type: SavedAddressType
  created_at: string
}

/** 현재 사용자의 저장 주소 목록 (타입별 선택) */
export async function getSavedAddresses(
  addressType?: SavedAddressType
): Promise<{ data?: SavedAddress[]; error?: string }> {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "로그인이 필요합니다." }
  }

  let query = supabase
    .from("customer_saved_addresses")
    .select("id, label, address, lat, lng, address_type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (addressType) {
    query = query.eq("address_type", addressType)
  }

  const { data, error } = await query
  if (error) {
    return { error: error.message }
  }
  return { data: (data ?? []).map((row) => ({ ...row, lat: Number(row.lat), lng: Number(row.lng) })) }
}

/** 저장 주소 추가 */
export async function addSavedAddress(params: {
  label: string
  address: string
  lat: number
  lng: number
  addressType: SavedAddressType
}): Promise<{ data?: SavedAddress; error?: string }> {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "로그인이 필요합니다." }
  }

  const label = (params.label || params.address || "저장 주소").trim().slice(0, 100)
  if (!params.address?.trim() || !Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    return { error: "주소와 좌표가 필요합니다." }
  }

  const { data, error } = await supabase
    .from("customer_saved_addresses")
    .insert({
      user_id: user.id,
      label: label || params.address.slice(0, 50),
      address: params.address.trim(),
      lat: params.lat,
      lng: params.lng,
      address_type: params.addressType,
    })
    .select("id, label, address, lat, lng, address_type, created_at")
    .single()

  if (error) {
    return { error: error.message }
  }
  return {
    data: data
      ? { ...data, lat: Number(data.lat), lng: Number(data.lng) }
      : undefined,
  }
}

/** 저장 주소 삭제 */
export async function deleteSavedAddress(id: string): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "로그인이 필요합니다." }
  }

  const { error } = await supabase
    .from("customer_saved_addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return { error: error.message }
  }
  return {}
}
